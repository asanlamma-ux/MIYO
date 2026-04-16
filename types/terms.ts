/**
 * Term Management types for MTL translation correction.
 *
 * A Term represents a single translation correction (original → corrected).
 * A TermGroup collects related terms and can be applied to multiple books,
 * enabling automatic text replacement in the reader.
 */

export interface Term {
  id: string;
  /** The word or phrase as it appears in the MTL / original text */
  originalText: string;
  /** Optional translation / source-side gloss shown in the reader term popup */
  translationText?: string;
  /** The user's preferred / corrected translation */
  correctedText: string;
  /** Optional example sentence for context */
  context?: string;
  /** Optional image shown in the reader term popup */
  imageUri?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TermGroup {
  id: string;
  /** User-given name, e.g. "Solo Leveling Terms" */
  name: string;
  description?: string;
  terms: Term[];
  /** Book IDs this group is applied to */
  appliedToBooks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityTermGroup extends TermGroup {
  /** Supabase user who created this group */
  createdBy: string;
  /** Number of downloads */
  downloads: number;
  /** Tags for searching */
  tags: string[];
  /** Whether this is an official pre-made group */
  isOfficial: boolean;
}
