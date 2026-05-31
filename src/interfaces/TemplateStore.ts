export interface EnrolledTemplate {
  userId: string;
  embeddings: number[][]; // array of EMBEDDING_DIM float vectors
  enrolledAt: number;
}

export interface TemplateStore {
  /** Persist one or more embeddings for a user. Overwrites any existing enrollment. */
  save(userId: string, embeddings: Float32Array[]): Promise<void>;

  /** Load all enrolled templates. */
  loadAll(): Promise<EnrolledTemplate[]>;

  /** Load templates for a specific user. Returns null if not enrolled. */
  load(userId: string): Promise<EnrolledTemplate | null>;

  /** Delete a user's enrollment. */
  delete(userId: string): Promise<void>;

  /** Count of enrolled users. */
  count(): Promise<number>;
}
