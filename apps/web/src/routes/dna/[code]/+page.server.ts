import type { PageServerLoad } from './$types';
import { PatternDNA } from '@guilloche/core';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { code } = params;

  // First, try to find in database
  const { data: dnaRecord } = await locals.supabase
    .from('pattern_dna')
    .select(`
      short_code,
      parameters_compressed,
      pattern_id,
      patterns (
        id,
        name,
        thumbnail_url,
        parameters
      )
    `)
    .eq('short_code', code)
    .single();

  if (dnaRecord) {
    // Found in database
    const pattern = dnaRecord.patterns as any;
    return {
      code,
      pattern: {
        id: pattern?.id,
        name: pattern?.name,
        thumbnail_url: pattern?.thumbnail_url,
        parameters: pattern?.parameters
      }
    };
  }

  // Try to decode from DNA string directly
  try {
    const params = PatternDNA.decode(code);
    if (params) {
      return {
        code,
        pattern: {
          id: null,
          name: 'Shared Pattern',
          thumbnail_url: null,
          parameters: params
        }
      };
    }
  } catch {
    // Invalid DNA
  }

  return {
    code,
    pattern: null
  };
};
