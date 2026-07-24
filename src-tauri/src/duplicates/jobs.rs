use crate::duplicates::errors::DuplicateError;
use once_cell::sync::Lazy;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex,
    },
};

#[derive(Debug)]
pub struct JobControl {
    paused: Mutex<bool>,
    pause_signal: Condvar,
    cancelled: AtomicBool,
}

impl JobControl {
    pub fn new() -> Self {
        Self { paused: Mutex::new(false), pause_signal: Condvar::new(), cancelled: AtomicBool::new(false) }
    }

    pub fn checkpoint(&self) -> Result<(), DuplicateError> {
        if self.cancelled.load(Ordering::SeqCst) { return Err(DuplicateError::ScanCancelled); }
        let mut paused = self.paused.lock().map_err(|_| DuplicateError::ScanCancelled)?;
        while *paused {
            paused = self.pause_signal.wait(paused).map_err(|_| DuplicateError::ScanCancelled)?;
            if self.cancelled.load(Ordering::SeqCst) { return Err(DuplicateError::ScanCancelled); }
        }
        Ok(())
    }

    pub fn pause(&self) { if let Ok(mut paused) = self.paused.lock() { *paused = true; } }
    pub fn resume(&self) { if let Ok(mut paused) = self.paused.lock() { *paused = false; self.pause_signal.notify_all(); } }
    pub fn cancel(&self) { self.cancelled.store(true, Ordering::SeqCst); self.resume(); }
}

pub static JOBS: Lazy<Mutex<HashMap<String, Arc<JobControl>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub fn register(job_id: &str) -> Arc<JobControl> {
    let control = Arc::new(JobControl::new());
    if let Ok(mut jobs) = JOBS.lock() { jobs.insert(job_id.to_string(), Arc::clone(&control)); }
    control
}

pub fn remove(job_id: &str) { if let Ok(mut jobs) = JOBS.lock() { jobs.remove(job_id); } }
pub fn control(job_id: &str) -> Option<Arc<JobControl>> { JOBS.lock().ok()?.get(job_id).cloned() }
pub fn list() -> Vec<String> { JOBS.lock().map(|jobs| jobs.keys().cloned().collect()).unwrap_or_default() }
