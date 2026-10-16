import { File, Paths } from 'expo-file-system';

export async function saveImagePermanently(sourceUri: string, prefix: string) {
  const extension = sourceUri.split('.').pop()?.split(/[?#]/)[0] || 'jpg';
  const destination = new File(Paths.document, `${prefix}-${Date.now()}.${extension}`);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}
