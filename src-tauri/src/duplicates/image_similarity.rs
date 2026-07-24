use crate::duplicates::{
    contracts::{
        DuplicateFileItem, DuplicateGroup, DuplicateJobProgress, DuplicateScanRequest,
        DuplicateScanResult,
    },
    errors::DuplicateError,
    hashing::full_blake3,
    jobs::JobControl,
    scanner::{scan_exact, ProgressCallback},
    traversal::collect_files,
};
use image::{imageops::FilterType, DynamicImage};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

fn dhash(image: &DynamicImage) -> u64 {
    let grayscale = image.resize_exact(9, 8, FilterType::Triangle).to_luma8();
    let mut hash = 0u64;
    let mut bit = 0u32;
    for y in 0..8 {
        for x in 0..8 {
            if grayscale.get_pixel(x, y)[0] > grayscale.get_pixel(x + 1, y)[0] {
                hash |= 1u64 << bit;
            }
            bit += 1;
        }
    }
    hash
}

fn similarity(left: u64, right: u64) -> f32 {
    (1.0 - (left ^ right).count_ones() as f32 / 64.0) * 100.0
}

#[derive(Debug, Clone)]
struct ImageEvidence {
    item: DuplicateFileItem,
    dhash: u64,
}

pub fn scan_images(
    operation_id: &str,
    job_id: &str,
    request: &DuplicateScanRequest,
    control: &JobControl,
    progress: ProgressCallback<'_>,
) -> Result<DuplicateScanResult, DuplicateError> {
    let mut filtered = request.clone();
    filtered.extensions = ["png", "jpg", "jpeg", "gif", "bmp", "tif", "tiff", "webp"]
        .iter()
        .map(|value| value.to_string())
        .collect();
    let mut result = scan_exact(
        operation_id,
        job_id,
        "similar_images",
        &filtered,
        control,
        progress,
    )?;
    let traversal = collect_files(&filtered, control)?;
    let total = traversal.files.len() as u64;
    let mut evidence = Vec::new();
    let exact_paths: HashSet<String> = result
        .groups
        .iter()
        .flat_map(|group| group.files.iter().map(|file| file.canonical_path.clone()))
        .collect();

    for (index, candidate) in traversal.files.into_iter().enumerate() {
        control.checkpoint()?;
        let decoded = match image::open(&candidate.canonical_path) {
            Ok(value) => value,
            Err(error) => {
                result.warnings.push(format!(
                    "image_decode_failed: {}: {error}",
                    candidate.canonical_path.display()
                ));
                continue;
            }
        };
        let (width, height) = (decoded.width(), decoded.height());
        let perceptual = dhash(&decoded);
        let hash = full_blake3(&candidate.canonical_path)?;
        evidence.push(ImageEvidence {
            dhash: perceptual,
            item: DuplicateFileItem {
                id: Uuid::new_v4().to_string(),
                path: candidate.path.to_string_lossy().to_string(),
                canonical_path: candidate.canonical_path.to_string_lossy().to_string(),
                name: candidate.name,
                extension: candidate.extension,
                size_bytes: candidate.size_bytes,
                modified_time: candidate.modified_time,
                created_time: candidate.created_time,
                hash,
                partial_hash: None,
                perceptual_hash: Some(format!("{perceptual:016x}")),
                similarity_score: None,
                mime_type: candidate.mime_type,
                width: Some(width),
                height: Some(height),
                file_identity: candidate.file_identity,
                hard_link_count: candidate.hard_link_count,
                is_hard_link_alias: false,
                protected_path: candidate.protected_path,
            },
        });
        if index % 16 == 0 {
            progress(DuplicateJobProgress {
                job_id: job_id.into(),
                operation_id: operation_id.into(),
                phase: "media_analysis".into(),
                mode: "determinate".into(),
                scanned_files: index as u64,
                total_files: Some(total),
                scanned_bytes: 0,
                current_path: Some(candidate.path.to_string_lossy().to_string()),
                candidate_groups: 0,
                verified_groups: result.groups.len() as u64,
                errors: result.warnings.len() as u64,
                can_pause: true,
                can_cancel: true,
            });
        }
    }

    let threshold = filtered.similarity_threshold.clamp(1.0, 100.0);
    let mut parent: Vec<usize> = (0..evidence.len()).collect();
    fn root(parent: &mut [usize], index: usize) -> usize {
        if parent[index] != index {
            let parent_index = parent[index];
            let value = root(parent, parent_index);
            parent[index] = value;
        }
        parent[index]
    }
    fn union(parent: &mut [usize], left: usize, right: usize) {
        let left_root = root(parent, left);
        let right_root = root(parent, right);
        if left_root != right_root {
            parent[right_root] = left_root;
        }
    }
    for left in 0..evidence.len() {
        for right in (left + 1)..evidence.len() {
            if evidence[left].item.hash != evidence[right].item.hash
                && similarity(evidence[left].dhash, evidence[right].dhash) >= threshold
            {
                union(&mut parent, left, right);
            }
        }
    }
    let mut clusters: HashMap<usize, Vec<usize>> = HashMap::new();
    for index in 0..evidence.len() {
        let cluster = root(&mut parent, index);
        clusters.entry(cluster).or_default().push(index);
    }
    for indexes in clusters.into_values().filter(|cluster| cluster.len() > 1) {
        let mut files = Vec::new();
        let reference = evidence[indexes[0]].dhash;
        for index in indexes {
            let mut item = evidence[index].item.clone();
            item.similarity_score = Some(similarity(reference, evidence[index].dhash));
            if !exact_paths.contains(&item.canonical_path) {
                files.push(item);
            }
        }
        if files.len() < 2 {
            continue;
        }
        let average = files
            .iter()
            .filter_map(|file| file.similarity_score)
            .sum::<f32>()
            / files.len() as f32;
        result.groups.push(DuplicateGroup {
            group_id: Uuid::new_v4().to_string(),
            mode: "similar_images".into(),
            category: "images".into(),
            files,
            wasted_size_bytes: 0,
            common_hash: format!("dhash:{reference:016x}"),
            proof_status: "visually_similar".into(),
            confidence: average / 100.0,
            actionable: false,
            warnings: vec![
                "Similar images require manual review and are never auto-selected.".into(),
            ],
        });
    }
    result.summary.duplicate_groups_found = result.groups.len() as u64;
    result.summary.duplicate_files_found = result
        .groups
        .iter()
        .map(|group| group.files.len() as u64)
        .sum();
    result.summary.scan_mode = "similar_images".into();
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{dhash, similarity};
    use image::{DynamicImage, ImageBuffer, Rgb};
    #[test]
    fn identical_images_have_full_similarity() {
        let image = DynamicImage::ImageRgb8(ImageBuffer::from_pixel(12, 12, Rgb([12, 24, 48])));
        assert_eq!(similarity(dhash(&image), dhash(&image)), 100.0);
    }
}
