/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  CurveFamilySchema,
  PatternParamsSchema,
  CreatePatternSchema,
  UpdatePatternSchema,
  AIRequestSchema,
  ExportRequestSchema,
  PurchaseRequestSchema,
  DNASchema,
  ProfileUpdateSchema,
  FeedbackSchema,
  validate,
  validateOrThrow,
  sanitizeString,
  sanitizeParams,
  createValidator,
} from '$lib/utils/validation';

describe('CurveFamilySchema', () => {
  it('should accept valid curve families', () => {
    const validFamilies = ['hypotrochoid', 'epitrochoid', 'rose', 'lissajous', 'spirograph', 'maurer'];

    validFamilies.forEach((family) => {
      expect(CurveFamilySchema.parse(family)).toBe(family);
    });
  });

  it('should reject invalid curve families', () => {
    expect(() => CurveFamilySchema.parse('invalid')).toThrow();
    expect(() => CurveFamilySchema.parse('')).toThrow();
    expect(() => CurveFamilySchema.parse(123)).toThrow();
  });
});

describe('PatternParamsSchema', () => {
  it('should accept valid pattern parameters', () => {
    const validParams = {
      family: 'hypotrochoid',
      R: 200,
      r: 80,
      d: 120,
      k: 7,
      steps: 10000,
      lw: 1,
      symmetry: 6,
      reflectH: false,
      reflectV: false,
      kaleidoscope: false,
      rotation: 45,
      bgColor: '#0f172a',
      startColor: '#3B82F6',
      endColor: '#8B5CF6',
      useGradient: true,
      glow: 5,
      vignette: false,
      dashed: false,
      dashRatio: 0.5,
    };

    const result = PatternParamsSchema.parse(validParams);
    expect(result.family).toBe('hypotrochoid');
    expect(result.R).toBe(200);
  });

  it('should apply default values for missing fields', () => {
    const result = PatternParamsSchema.parse({});

    expect(result.family).toBe('hypotrochoid');
    expect(result.R).toBe(200);
    expect(result.r).toBe(80);
    expect(result.d).toBe(120);
    expect(result.k).toBe(7);
    expect(result.steps).toBe(10000);
    expect(result.lw).toBe(1);
    expect(result.symmetry).toBe(1);
    expect(result.reflectH).toBe(false);
    expect(result.reflectV).toBe(false);
    expect(result.bgColor).toBe('#0f172a');
    expect(result.startColor).toBe('#3B82F6');
    expect(result.endColor).toBe('#8B5CF6');
  });

  it('should reject R values outside range', () => {
    expect(() => PatternParamsSchema.parse({ R: 5 })).toThrow();
    expect(() => PatternParamsSchema.parse({ R: 501 })).toThrow();
  });

  it('should reject r values outside range', () => {
    expect(() => PatternParamsSchema.parse({ r: 4 })).toThrow();
    expect(() => PatternParamsSchema.parse({ r: 401 })).toThrow();
  });

  it('should reject d values outside range', () => {
    expect(() => PatternParamsSchema.parse({ d: -1 })).toThrow();
    expect(() => PatternParamsSchema.parse({ d: 401 })).toThrow();
  });

  it('should reject invalid color formats', () => {
    expect(() => PatternParamsSchema.parse({ bgColor: 'red' })).toThrow();
    expect(() => PatternParamsSchema.parse({ bgColor: '#fff' })).toThrow();
    expect(() => PatternParamsSchema.parse({ bgColor: '#GGGGGG' })).toThrow();
    expect(() => PatternParamsSchema.parse({ startColor: 'rgb(0,0,0)' })).toThrow();
  });

  it('should accept valid hex color formats', () => {
    const result = PatternParamsSchema.parse({
      bgColor: '#ffffff',
      startColor: '#AABBCC',
      endColor: '#123456',
    });
    expect(result.bgColor).toBe('#ffffff');
    expect(result.startColor).toBe('#AABBCC');
    expect(result.endColor).toBe('#123456');
  });

  it('should accept optional lissajous parameters', () => {
    const result = PatternParamsSchema.parse({
      a: 3,
      b: 4,
      delta: Math.PI / 2,
    });
    expect(result.a).toBe(3);
    expect(result.b).toBe(4);
    expect(result.delta).toBe(Math.PI / 2);
  });

  it('should reject lissajous parameters outside range', () => {
    expect(() => PatternParamsSchema.parse({ a: 0 })).toThrow();
    expect(() => PatternParamsSchema.parse({ a: 21 })).toThrow();
    expect(() => PatternParamsSchema.parse({ b: 0 })).toThrow();
    expect(() => PatternParamsSchema.parse({ delta: -1 })).toThrow();
  });

  it('should reject steps outside range', () => {
    expect(() => PatternParamsSchema.parse({ steps: 99 })).toThrow();
    expect(() => PatternParamsSchema.parse({ steps: 100001 })).toThrow();
  });

  it('should reject invalid symmetry values', () => {
    expect(() => PatternParamsSchema.parse({ symmetry: 0 })).toThrow();
    expect(() => PatternParamsSchema.parse({ symmetry: 25 })).toThrow();
  });

  it('should reject invalid rotation values', () => {
    expect(() => PatternParamsSchema.parse({ rotation: -1 })).toThrow();
    expect(() => PatternParamsSchema.parse({ rotation: 361 })).toThrow();
  });

  it('should reject invalid glow values', () => {
    expect(() => PatternParamsSchema.parse({ glow: -1 })).toThrow();
    expect(() => PatternParamsSchema.parse({ glow: 51 })).toThrow();
  });

  it('should reject invalid dashRatio values', () => {
    expect(() => PatternParamsSchema.parse({ dashRatio: 0.05 })).toThrow();
    expect(() => PatternParamsSchema.parse({ dashRatio: 0.95 })).toThrow();
  });
});

describe('CreatePatternSchema', () => {
  it('should accept valid pattern creation request', () => {
    const validRequest = {
      name: 'My Pattern',
      description: 'A beautiful pattern',
      parameters: {},
      isPublic: true,
      isListed: true,
      tags: ['geometric', 'blue'],
    };

    const result = CreatePatternSchema.parse(validRequest);
    expect(result.name).toBe('My Pattern');
    expect(result.isPublic).toBe(true);
    expect(result.tags).toEqual(['geometric', 'blue']);
  });

  it('should reject empty name', () => {
    expect(() => CreatePatternSchema.parse({ name: '', parameters: {} })).toThrow();
  });

  it('should reject name exceeding max length', () => {
    expect(() => CreatePatternSchema.parse({ name: 'a'.repeat(101), parameters: {} })).toThrow();
  });

  it('should reject description exceeding max length', () => {
    expect(() => CreatePatternSchema.parse({
      name: 'Test',
      description: 'a'.repeat(1001),
      parameters: {},
    })).toThrow();
  });

  it('should reject more than 10 tags', () => {
    const tooManyTags = Array(11).fill('tag');
    expect(() => CreatePatternSchema.parse({
      name: 'Test',
      parameters: {},
      tags: tooManyTags,
    })).toThrow();
  });

  it('should reject tag exceeding max length', () => {
    expect(() => CreatePatternSchema.parse({
      name: 'Test',
      parameters: {},
      tags: ['a'.repeat(51)],
    })).toThrow();
  });

  it('should apply default values', () => {
    const result = CreatePatternSchema.parse({ name: 'Test', parameters: {} });
    expect(result.isPublic).toBe(false);
    expect(result.isListed).toBe(false);
  });
});

describe('UpdatePatternSchema', () => {
  it('should accept valid update request with id', () => {
    const validRequest = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Updated Name',
    };

    const result = UpdatePatternSchema.parse(validRequest);
    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.name).toBe('Updated Name');
  });

  it('should reject invalid UUID', () => {
    expect(() => UpdatePatternSchema.parse({ id: 'invalid-uuid' })).toThrow();
    expect(() => UpdatePatternSchema.parse({ id: '12345' })).toThrow();
  });

  it('should allow partial updates', () => {
    const result = UpdatePatternSchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      isPublic: true,
    });
    expect(result.isPublic).toBe(true);
    expect(result.name).toBeUndefined();
  });
});

describe('AIRequestSchema', () => {
  it('should accept valid AI request', () => {
    const validRequest = {
      keywords: ['geometric', 'spiral'],
      style: 'modern',
      complexity: 'moderate',
    };

    const result = AIRequestSchema.parse(validRequest);
    expect(result.keywords).toEqual(['geometric', 'spiral']);
    expect(result.style).toBe('modern');
  });

  it('should reject empty keywords array', () => {
    expect(() => AIRequestSchema.parse({ keywords: [] })).toThrow();
  });

  it('should reject more than 10 keywords', () => {
    const tooManyKeywords = Array(11).fill('keyword');
    expect(() => AIRequestSchema.parse({ keywords: tooManyKeywords })).toThrow();
  });

  it('should reject empty keyword strings', () => {
    expect(() => AIRequestSchema.parse({ keywords: [''] })).toThrow();
  });

  it('should reject keyword exceeding max length', () => {
    expect(() => AIRequestSchema.parse({ keywords: ['a'.repeat(51)] })).toThrow();
  });

  it('should reject invalid style', () => {
    expect(() => AIRequestSchema.parse({ keywords: ['test'], style: 'invalid' })).toThrow();
  });

  it('should reject invalid complexity', () => {
    expect(() => AIRequestSchema.parse({ keywords: ['test'], complexity: 'invalid' })).toThrow();
  });

  it('should accept all valid styles', () => {
    const styles = ['geometric', 'organic', 'classic', 'modern'];
    styles.forEach((style) => {
      const result = AIRequestSchema.parse({ keywords: ['test'], style });
      expect(result.style).toBe(style);
    });
  });

  it('should accept all valid complexities', () => {
    const complexities = ['simple', 'moderate', 'complex'];
    complexities.forEach((complexity) => {
      const result = AIRequestSchema.parse({ keywords: ['test'], complexity });
      expect(result.complexity).toBe(complexity);
    });
  });
});

describe('ExportRequestSchema', () => {
  it('should accept valid export request', () => {
    const validRequest = {
      format: 'svg',
      parameters: {},
      options: {
        width: 1920,
        height: 1080,
        dpi: 300,
        background: true,
        optimizePath: true,
        tolerance: 0.5,
      },
    };

    const result = ExportRequestSchema.parse(validRequest);
    expect(result.format).toBe('svg');
    expect(result.options?.width).toBe(1920);
  });

  it('should accept all valid formats', () => {
    const formats = ['svg', 'png', 'pdf', 'dxf', 'gcode', 'hpgl'];
    formats.forEach((format) => {
      const result = ExportRequestSchema.parse({ format, parameters: {} });
      expect(result.format).toBe(format);
    });
  });

  it('should reject invalid format', () => {
    expect(() => ExportRequestSchema.parse({ format: 'jpg', parameters: {} })).toThrow();
  });

  it('should apply default option values', () => {
    const result = ExportRequestSchema.parse({
      format: 'png',
      parameters: {},
      options: {},
    });
    expect(result.options?.width).toBe(1920);
    expect(result.options?.height).toBe(1080);
    expect(result.options?.dpi).toBe(300);
  });

  it('should reject width outside range', () => {
    expect(() => ExportRequestSchema.parse({
      format: 'png',
      parameters: {},
      options: { width: 99 },
    })).toThrow();
    expect(() => ExportRequestSchema.parse({
      format: 'png',
      parameters: {},
      options: { width: 16001 },
    })).toThrow();
  });

  it('should reject dpi outside range', () => {
    expect(() => ExportRequestSchema.parse({
      format: 'png',
      parameters: {},
      options: { dpi: 71 },
    })).toThrow();
    expect(() => ExportRequestSchema.parse({
      format: 'png',
      parameters: {},
      options: { dpi: 601 },
    })).toThrow();
  });
});

describe('PurchaseRequestSchema', () => {
  it('should accept valid purchase request', () => {
    const validRequest = {
      patternId: '123e4567-e89b-12d3-a456-426614174000',
      licenseType: 'commercial',
    };

    const result = PurchaseRequestSchema.parse(validRequest);
    expect(result.patternId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(result.licenseType).toBe('commercial');
  });

  it('should reject invalid UUID', () => {
    expect(() => PurchaseRequestSchema.parse({
      patternId: 'invalid',
      licenseType: 'personal',
    })).toThrow();
  });

  it('should reject invalid license type', () => {
    expect(() => PurchaseRequestSchema.parse({
      patternId: '123e4567-e89b-12d3-a456-426614174000',
      licenseType: 'invalid',
    })).toThrow();
  });

  it('should accept all valid license types', () => {
    const licenseTypes = ['personal', 'commercial', 'remix'];
    licenseTypes.forEach((licenseType) => {
      const result = PurchaseRequestSchema.parse({
        patternId: '123e4567-e89b-12d3-a456-426614174000',
        licenseType,
      });
      expect(result.licenseType).toBe(licenseType);
    });
  });
});

describe('DNASchema', () => {
  it('should accept valid DNA codes', () => {
    const validCodes = ['abc123', 'ABC123DEF', 'a1b2c3d4e5f6'];
    validCodes.forEach((code) => {
      const result = DNASchema.parse({ code });
      expect(result.code).toBe(code);
    });
  });

  it('should reject DNA codes that are too short', () => {
    expect(() => DNASchema.parse({ code: 'abc12' })).toThrow();
  });

  it('should reject DNA codes that are too long', () => {
    expect(() => DNASchema.parse({ code: 'a'.repeat(13) })).toThrow();
  });

  it('should reject DNA codes with invalid characters', () => {
    expect(() => DNASchema.parse({ code: 'abc-123' })).toThrow();
    expect(() => DNASchema.parse({ code: 'abc_123' })).toThrow();
    expect(() => DNASchema.parse({ code: 'abc 123' })).toThrow();
    expect(() => DNASchema.parse({ code: 'abc!123' })).toThrow();
  });
});

describe('ProfileUpdateSchema', () => {
  it('should accept valid profile update', () => {
    const validRequest = {
      username: 'john_doe',
      displayName: 'John Doe',
      bio: 'I love creating patterns!',
      website: 'https://example.com',
    };

    const result = ProfileUpdateSchema.parse(validRequest);
    expect(result.username).toBe('john_doe');
    expect(result.displayName).toBe('John Doe');
  });

  it('should accept valid username formats', () => {
    const validUsernames = ['john', 'john_doe', 'john-doe', 'JohnDoe123'];
    validUsernames.forEach((username) => {
      const result = ProfileUpdateSchema.parse({ username });
      expect(result.username).toBe(username);
    });
  });

  it('should reject username that is too short', () => {
    expect(() => ProfileUpdateSchema.parse({ username: 'ab' })).toThrow();
  });

  it('should reject username that is too long', () => {
    expect(() => ProfileUpdateSchema.parse({ username: 'a'.repeat(31) })).toThrow();
  });

  it('should reject username with invalid characters', () => {
    expect(() => ProfileUpdateSchema.parse({ username: 'john doe' })).toThrow();
    expect(() => ProfileUpdateSchema.parse({ username: 'john@doe' })).toThrow();
    expect(() => ProfileUpdateSchema.parse({ username: 'john.doe' })).toThrow();
  });

  it('should reject bio exceeding max length', () => {
    expect(() => ProfileUpdateSchema.parse({ bio: 'a'.repeat(501) })).toThrow();
  });

  it('should accept empty website string', () => {
    const result = ProfileUpdateSchema.parse({ website: '' });
    expect(result.website).toBe('');
  });

  it('should reject invalid website URL', () => {
    expect(() => ProfileUpdateSchema.parse({ website: 'not-a-url' })).toThrow();
    expect(() => ProfileUpdateSchema.parse({ website: 'example.com' })).toThrow();
    expect(() => ProfileUpdateSchema.parse({ website: 'www.example.com' })).toThrow();
  });

  it('should accept valid URL protocols', () => {
    // Zod's url() validator accepts various valid URL schemes
    const result1 = ProfileUpdateSchema.parse({ website: 'https://example.com' });
    expect(result1.website).toBe('https://example.com');

    const result2 = ProfileUpdateSchema.parse({ website: 'http://example.com' });
    expect(result2.website).toBe('http://example.com');
  });
});

describe('FeedbackSchema', () => {
  it('should accept valid feedback', () => {
    const validFeedback = {
      type: 'feature',
      subject: 'Great feature idea',
      message: 'Here is my detailed feature request...',
      email: 'user@example.com',
    };

    const result = FeedbackSchema.parse(validFeedback);
    expect(result.type).toBe('feature');
    expect(result.email).toBe('user@example.com');
  });

  it('should accept all valid feedback types', () => {
    const types = ['bug', 'feature', 'question', 'other'];
    types.forEach((type) => {
      const result = FeedbackSchema.parse({
        type,
        subject: 'Test subject here',
        message: 'This is a test message that is long enough',
      });
      expect(result.type).toBe(type);
    });
  });

  it('should reject invalid feedback type', () => {
    expect(() => FeedbackSchema.parse({
      type: 'invalid',
      subject: 'Test',
      message: 'This is a test message',
    })).toThrow();
  });

  it('should reject subject that is too short', () => {
    expect(() => FeedbackSchema.parse({
      type: 'bug',
      subject: 'Test',
      message: 'This is a test message that is long enough',
    })).toThrow();
  });

  it('should reject subject exceeding max length', () => {
    expect(() => FeedbackSchema.parse({
      type: 'bug',
      subject: 'a'.repeat(201),
      message: 'This is a test message that is long enough',
    })).toThrow();
  });

  it('should reject message that is too short', () => {
    expect(() => FeedbackSchema.parse({
      type: 'bug',
      subject: 'Valid subject here',
      message: 'Too short',
    })).toThrow();
  });

  it('should reject message exceeding max length', () => {
    expect(() => FeedbackSchema.parse({
      type: 'bug',
      subject: 'Valid subject here',
      message: 'a'.repeat(5001),
    })).toThrow();
  });

  it('should reject invalid email format', () => {
    expect(() => FeedbackSchema.parse({
      type: 'bug',
      subject: 'Valid subject here',
      message: 'This is a valid message that is long enough',
      email: 'not-an-email',
    })).toThrow();
  });
});

describe('validate helper', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(0),
  });

  it('should return success with valid data', () => {
    const result = validate(TestSchema, { name: 'John', age: 25 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John', age: 25 });
    expect(result.errors).toBeUndefined();
  });

  it('should return errors with invalid data', () => {
    const result = validate(TestSchema, { name: '', age: -1 });
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should format error paths correctly', () => {
    const NestedSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1),
        }),
      }),
    });

    const result = validate(NestedSchema, { user: { profile: { name: '' } } });
    expect(result.success).toBe(false);
    expect(result.errors![0].path).toBe('user.profile.name');
  });
});

describe('validateOrThrow helper', () => {
  const TestSchema = z.object({
    value: z.number(),
  });

  it('should return data when valid', () => {
    const result = validateOrThrow(TestSchema, { value: 42 });
    expect(result).toEqual({ value: 42 });
  });

  it('should throw when invalid', () => {
    expect(() => validateOrThrow(TestSchema, { value: 'not-a-number' })).toThrow();
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should remove angle brackets', () => {
    expect(sanitizeString('hello<script>alert("xss")</script>world')).toBe('helloscriptalert("xss")/scriptworld');
  });

  it('should limit string length to 10000 characters', () => {
    const longString = 'a'.repeat(15000);
    expect(sanitizeString(longString).length).toBe(10000);
  });

  it('should handle empty strings', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('should handle strings with only whitespace', () => {
    expect(sanitizeString('   ')).toBe('');
  });
});

describe('sanitizeParams', () => {
  it('should return valid params unchanged', () => {
    const params = { R: 200, r: 80, d: 120 };
    const result = sanitizeParams(params);
    expect(result.R).toBe(200);
    expect(result.r).toBe(80);
  });

  it('should return empty object for null', () => {
    expect(sanitizeParams(null)).toEqual({});
  });

  it('should return empty object for non-object', () => {
    expect(sanitizeParams('string')).toEqual({});
    expect(sanitizeParams(123)).toEqual({});
    expect(sanitizeParams(true)).toEqual({});
  });

  it('should return empty object for invalid params', () => {
    const result = sanitizeParams({ R: 'invalid' });
    expect(result).toEqual({});
  });

  it('should apply defaults for missing values', () => {
    const result = sanitizeParams({});
    expect(result.R).toBe(200);
    expect(result.family).toBe('hypotrochoid');
  });
});

describe('createValidator', () => {
  const TestSchema = z.object({
    email: z.string().email(),
  });

  it('should return valid: true with valid data', async () => {
    const validator = createValidator(TestSchema);
    const result = await validator({ email: 'test@example.com' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual({ email: 'test@example.com' });
    }
  });

  it('should return valid: false with error message for invalid data', async () => {
    const validator = createValidator(TestSchema);
    const result = await validator({ email: 'invalid' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('email');
    }
  });

  it('should format multiple errors correctly', async () => {
    const MultiFieldSchema = z.object({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    const validator = createValidator(MultiFieldSchema);
    const result = await validator({ name: '', age: -1 });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain(', ');
    }
  });
});
