/**
 * Unit tests for Devin for Terminal agent registration and config.
 *
 * Verifies:
 * - 'devin' exists in agents record (type correctness)
 * - Config fields: name, displayName, skillsDir, globalSkillsDir
 * - Detection logic (both branches: directory exists / does not exist)
 * - Non-universal classification (isUniversalAgent, getNonUniversalAgents)
 * - No duplicate names or conflicting directories
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

// Create a controllable mock for existsSync, hoisted before all imports
const mockExistsSync = vi.hoisted(() => vi.fn(() => false));

// Mock the 'fs' module so agents.ts uses our mock existsSync
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

import {
  agents,
  getAgentConfig,
  getNonUniversalAgents,
  getUniversalAgents,
  isUniversalAgent,
} from '../src/agents.ts';

const home = homedir();
const configHome = process.env.XDG_CONFIG_HOME || join(home, '.config');

describe('Devin agent config', () => {
  it('exists in agents record', () => {
    expect(agents).toHaveProperty('devin');
    expect(agents.devin).toBeDefined();
  });

  it('has correct name', () => {
    expect(agents.devin.name).toBe('devin');
  });

  it('has correct displayName', () => {
    expect(agents.devin.displayName).toBe('Devin for Terminal');
  });

  it('has correct skillsDir', () => {
    expect(agents.devin.skillsDir).toBe('.devin/skills');
  });

  it('has correct globalSkillsDir (XDG-style)', () => {
    const expected = join(configHome, 'devin', 'skills');
    expect(agents.devin.globalSkillsDir).toBe(expected);
  });

  it('does NOT use platform-specific paths for globalSkillsDir', () => {
    expect(agents.devin.globalSkillsDir).not.toContain('Library');
    expect(agents.devin.globalSkillsDir).not.toContain('Preferences');
    expect(agents.devin.globalSkillsDir).not.toContain('AppData');
  });

  it('has a detectInstalled function', () => {
    expect(typeof agents.devin.detectInstalled).toBe('function');
  });

  it('is accessible via getAgentConfig', () => {
    const config = getAgentConfig('devin');
    expect(config.name).toBe('devin');
    expect(config.displayName).toBe('Devin for Terminal');
  });
});

describe('Devin detection logic', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it('returns true when ~/.config/devin exists', async () => {
    mockExistsSync.mockImplementation((p: any) => {
      return String(p) === join(configHome, 'devin');
    });
    const result = await agents.devin.detectInstalled();
    expect(result).toBe(true);
  });

  it('returns false when ~/.config/devin does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await agents.devin.detectInstalled();
    expect(result).toBe(false);
  });
});

describe('Devin non-universal classification', () => {
  it('isUniversalAgent returns false for devin', () => {
    expect(isUniversalAgent('devin')).toBe(false);
  });

  it('is included in getNonUniversalAgents', () => {
    const nonUniversal = getNonUniversalAgents();
    expect(nonUniversal).toContain('devin');
  });

  it('is NOT included in getUniversalAgents', () => {
    const universal = getUniversalAgents();
    expect(universal).not.toContain('devin');
  });
});

describe('Devin no duplicates', () => {
  it('devin appears exactly once as a key in agents record', () => {
    const keys = Object.keys(agents);
    const devinCount = keys.filter((k) => k === 'devin').length;
    expect(devinCount).toBe(1);
  });

  it('displayName "Devin for Terminal" is unique across all agents', () => {
    const displayNames = Object.values(agents).map((a) => a.displayName);
    const devinDisplayCount = displayNames.filter((d) => d === 'Devin for Terminal').length;
    expect(devinDisplayCount).toBe(1);
  });

  it('skillsDir ".devin/skills" is unique across all agents', () => {
    const skillsDirs = Object.values(agents).map((a) => a.skillsDir);
    const devinDirCount = skillsDirs.filter((d) => d === '.devin/skills').length;
    expect(devinDirCount).toBe(1);
  });

  it('globalSkillsDir is unique across all agents', () => {
    const globalDirs = Object.values(agents)
      .map((a) => a.globalSkillsDir)
      .filter(Boolean);
    const devinGlobalDir = agents.devin.globalSkillsDir;
    const count = globalDirs.filter((d) => d === devinGlobalDir).length;
    expect(count).toBe(1);
  });
});
