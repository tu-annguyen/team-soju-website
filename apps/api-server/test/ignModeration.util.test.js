const {
  findBlacklistedIgnMatch,
  isIgnBlacklisted,
  normalizeIgnForModeration,
} = require('../src/utils/ignModeration');

describe('IGN moderation utilities', () => {
  const originalIgnBlacklist = process.env.IGN_BLACKLIST;
  const originalIgnSubstringBlacklist = process.env.IGN_SUBSTRING_BLACKLIST;

  beforeEach(() => {
    process.env.IGN_BLACKLIST = 'BannedIGN, Mr Mime';
    process.env.IGN_SUBSTRING_BLACKLIST = 'trashlord';
  });

  afterAll(() => {
    process.env.IGN_BLACKLIST = originalIgnBlacklist;
    process.env.IGN_SUBSTRING_BLACKLIST = originalIgnSubstringBlacklist;
  });

  it('normalizes casing, whitespace, and punctuation for comparisons', () => {
    expect(normalizeIgnForModeration('  Mr. Mime  ')).toBe('mrmime');
    expect(normalizeIgnForModeration('BANNED ign')).toBe('bannedign');
  });

  it('matches blacklisted IGNs despite formatting changes', () => {
    expect(findBlacklistedIgnMatch('banned ign')).toBe('BannedIGN');
    expect(findBlacklistedIgnMatch('Mr. Mime')).toBe('Mr Mime');
    expect(isIgnBlacklisted('mr-mime')).toBe(true);
  });

  it('matches substring profanity blacklist entries when embedded in an IGN', () => {
    expect(findBlacklistedIgnMatch('EliteAssholeHunter')).toBe('asshole');
    expect(findBlacklistedIgnMatch('xXTrashLord420xX')).toBe('trashlord');
    expect(isIgnBlacklisted('EliteAssholeHunter')).toBe(true);
  });

  it('does not apply exact-name blacklist entries as substring matches', () => {
    expect(findBlacklistedIgnMatch('xXBannedIGNxX')).toBeNull();
    expect(findBlacklistedIgnMatch('trainer-darku-alt')).toBeNull();
    expect(isIgnBlacklisted('darku')).toBe(true);
  });

  it('does not match unrelated IGNs', () => {
    expect(findBlacklistedIgnMatch('Trainer')).toBeNull();
    expect(findBlacklistedIgnMatch('ClassAct')).toBeNull();
    expect(isIgnBlacklisted('Trainer')).toBe(false);
  });
});
