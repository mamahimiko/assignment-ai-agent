import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const deleteOwnAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:docs,error}=await context.supabase.from('documents').select('storage_path').eq('user_id',context.userId);
  if(error) throw new Error('Unable to read your documents for deletion.');
  // Identity is verified by middleware; privileged deletion is limited to that exact identity.
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  if(docs?.length){const {error:storageError}=await supabaseAdmin.storage.from('financial-documents').remove(docs.map(d=>d.storage_path));if(storageError)throw new Error('Unable to delete documents. Your account has not been deleted.');}
  const {error:deleteError}=await supabaseAdmin.auth.admin.deleteUser(context.userId);
  if(deleteError) throw new Error('Unable to delete your account.');
  return {deleted:true};
});