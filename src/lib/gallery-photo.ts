export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string | null;
  /** Local blob preview while upload is in progress */
  pending?: boolean;
  uploading?: boolean;
  uploadError?: boolean;
};
