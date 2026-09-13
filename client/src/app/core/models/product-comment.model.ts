/**
 * Commentaire de preparation attache a un produit.
 * productId null = commentaire global, propose pour tous les produits.
 */
export interface ProductComment {
  id: number;
  label: string;
  productId?: number | null;
  displayIndex?: number | null;
  isActive: boolean;
  product?: { id: number; name: string } | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateProductCommentRequest {
  label: string;
  productId?: number | null;
  displayIndex?: number | null;
}
