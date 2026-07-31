import type { PageServerLoad, Actions } from './$types';
import { error, redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    throw redirect(303, '/auth/login');
  }

  const patternId = params.id;

  // Get pattern details
  const { data: pattern, error: patternError } = await locals.supabase
    .from('patterns')
    .select('*')
    .eq('id', patternId)
    .eq('user_id', user.id)
    .single();

  if (patternError || !pattern) {
    throw error(404, 'Pattern not found');
  }

  return {
    pattern,
  };
};

export const actions: Actions = {
  updateListing: async ({ request, params, locals }) => {
    const { session, user } = await locals.safeGetSession();

    if (!session || !user) {
      return fail(401, { error: 'Authentication required' });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price_cents = parseInt(formData.get('price_cents') as string) || 0;
    const license_type = formData.get('license_type') as string;
    const tags = (formData.get('tags') as string)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    const is_listed = formData.get('is_listed') === 'true';
    const is_public = formData.get('is_public') === 'true';

    // Validate
    if (!name?.trim()) {
      return fail(400, { error: 'Name is required' });
    }

    if (!['personal', 'commercial', 'remix'].includes(license_type)) {
      return fail(400, { error: 'Invalid license type' });
    }

    // Update pattern
    const { error: updateError } = await locals.supabase
      .from('patterns')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        price_cents,
        license_type,
        tags,
        is_listed,
        is_public: is_listed ? true : is_public, // Listed patterns must be public
      })
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update pattern:', updateError);
      return fail(500, { error: 'Failed to update pattern' });
    }

    return { success: true };
  },

  delete: async ({ params, locals }) => {
    const { session, user } = await locals.safeGetSession();

    if (!session || !user) {
      return fail(401, { error: 'Authentication required' });
    }

    const { error: deleteError } = await locals.supabase
      .from('patterns')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to delete pattern:', deleteError);
      return fail(500, { error: 'Failed to delete pattern' });
    }

    throw redirect(303, '/patterns');
  },
};
