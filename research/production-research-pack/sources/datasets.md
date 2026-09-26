# Test Fixtures and Datasets

Prefer generated/local fixtures over copyrighted corpora.

Required fixture families:
- duplicate byte files and hard-link aliases;
- resized/rotated/recompressed images with ground-truth labels;
- short licensed/self-generated video transcodes and trims;
- self-generated audio with tag/container/gain/silence variants;
- ZIP/7z/RAR archives with Unicode/Arabic names and malicious path/bomb metadata fixtures;
- long paths, denied ACL paths, junction loops, sparse files, OneDrive placeholders;
- synthetic event-log exports where redistribution is legal;
- isolated Windows VMs for destructive repair/reset testing.

Every external fixture must carry source URL, license, attribution and redistribution status.
