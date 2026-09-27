import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8');

const workspace = read('src/features/cleanup/SmartCleanupWorkspace.tsx');
const plannedPanels = read('src/features/cleanup/CleanupPlannedPanels.tsx');
const scanner = read('src-tauri/src/completion14/m02.rs');
const contracts = read('src-tauri/src/cleanup/contracts.rs');

/**
 * A capped measurement must never be rendered as a complete one.
 *
 * A real run on this machine reported exactly 5,000 files for two different
 * categories. `default_item_limit()` is 5,000, so both had stopped at the
 * per-category ceiling, and the workspace said nothing about it: the headline
 * total, the per-category rows and the category cards all presented a partial
 * count as if it were the whole number. The scanner already sets the flag, so
 * the defect was purely that nobody rendered it.
 */
describe('cleanup scan ceiling honesty', () => {
  it('has a per-category item ceiling and records when a category hits it', () => {
    expect(contracts).toMatch(/fn default_item_limit\(\) -> usize \{\s*5_000\s*\}/);
    expect(scanner).toMatch(/if items\.len\(\) >= limit \{\s*truncated = true;/);
    expect(scanner).toMatch(/pub truncated: bool,/);
  });

  it('renders the truncation on the category card', () => {
    expect(workspace).toMatch(/measured\?\.truncated &&/);
    expect(workspace).toMatch(/Capped - this count is a floor, not the total/);
  });

  it('renders the truncation on each measured category row', () => {
    expect(workspace).toMatch(/category\.truncated &&/);
    expect(workspace).toMatch(/Stopped at the per-category item ceiling/);
  });

  it('marks the headline total as a floor when any category was capped', () => {
    expect(workspace).toMatch(/truncatedCategories\.length > 0 &&/);
    expect(workspace).toMatch(/so this total is a floor, not a total/);
    expect(workspace).toMatch(/filter\(category => category\.truncated\)/);
  });

  /**
   * The scheduled-profile and Recycle Bin panels already disclosed their ceilings.
   * If that ever stops being true, the ordinary scan panel is no longer the
   * outlier it was fixed to stop being, and this fails rather than the gap
   * quietly moving somewhere else.
   */
  it('keeps the sibling panels disclosing their ceilings too', () => {
    expect(plannedPanels).toMatch(/root\.truncated &&/);
    expect(plannedPanels).toMatch(/recycle\.itemsTruncated &&/);
    expect(plannedPanels).toMatch(/profileResult\.measurement\.scanTruncated &&/);
  });
});
