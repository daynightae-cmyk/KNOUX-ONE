use crate::duplicates::errors::DuplicateError;
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::Path,
};

const SAMPLE_SIZE: usize = 64 * 1024;
const STREAM_BUFFER: usize = 1024 * 1024;

fn read_sample(file: &mut File, offset: u64, length: usize) -> Result<Vec<u8>, DuplicateError> {
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| DuplicateError::HashReadFailed(error.to_string()))?;
    let mut buffer = vec![0u8; length];
    let read = file
        .read(&mut buffer)
        .map_err(|error| DuplicateError::HashReadFailed(error.to_string()))?;
    buffer.truncate(read);
    Ok(buffer)
}

pub fn partial_blake3(path: &Path, size: u64) -> Result<String, DuplicateError> {
    let mut file = File::open(path)
        .map_err(|error| DuplicateError::FileLocked(format!("{}: {error}", path.display())))?;
    let sample = SAMPLE_SIZE.min(size as usize);
    let middle = size.saturating_sub(sample as u64) / 2;
    let end = size.saturating_sub(sample as u64);
    let mut hasher = blake3::Hasher::new();
    hasher.update(&size.to_le_bytes());
    for offset in [0, middle, end] {
        let bytes = read_sample(&mut file, offset, sample)?;
        hasher.update(&(offset as u128).to_le_bytes());
        hasher.update(&bytes);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

pub fn full_blake3(path: &Path) -> Result<String, DuplicateError> {
    let mut file = File::open(path)
        .map_err(|error| DuplicateError::FileLocked(format!("{}: {error}", path.display())))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = vec![0u8; STREAM_BUFFER];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            DuplicateError::HashReadFailed(format!("{}: {error}", path.display()))
        })?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

pub fn sha256(path: &Path) -> Result<String, DuplicateError> {
    use sha2::{Digest, Sha256};
    let mut file = File::open(path)
        .map_err(|error| DuplicateError::FileLocked(format!("{}: {error}", path.display())))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; STREAM_BUFFER];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            DuplicateError::HashReadFailed(format!("{}: {error}", path.display()))
        })?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn verify_unchanged(
    path: &Path,
    size_before: u64,
    modified_before: Option<std::time::SystemTime>,
) -> Result<(), DuplicateError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() != size_before || metadata.modified().ok() != modified_before {
        return Err(DuplicateError::FileChangedDuringScan(
            path.display().to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{full_blake3, partial_blake3};
    use std::fs;

    #[test]
    fn equal_files_have_equal_full_and_partial_hashes() {
        let directory = tempfile::tempdir().expect("tempdir");
        let left = directory.path().join("left.bin");
        let right = directory.path().join("right.bin");
        fs::write(&left, b"KNOUX duplicate engine test payload").expect("left");
        fs::copy(&left, &right).expect("copy");
        assert_eq!(full_blake3(&left).unwrap(), full_blake3(&right).unwrap());
        assert_eq!(
            partial_blake3(&left, fs::metadata(&left).unwrap().len()).unwrap(),
            partial_blake3(&right, fs::metadata(&right).unwrap().len()).unwrap()
        );
    }

    #[test]
    fn equal_size_different_files_have_different_full_hashes() {
        let directory = tempfile::tempdir().expect("tempdir");
        let left = directory.path().join("left.bin");
        let right = directory.path().join("right.bin");
        fs::write(&left, b"AAAA").expect("left");
        fs::write(&right, b"BBBB").expect("right");
        assert_ne!(full_blake3(&left).unwrap(), full_blake3(&right).unwrap());
    }
}
