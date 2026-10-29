export interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  status: string;
  mappingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  options: {
    id: string;
    naverOptionId: string;
    rawName: string;
    color: string | null;
    size: string | null;
    priceAdjustment: string;
    stockQuantity: number | null;
    usable: boolean;
    active: boolean;
  }[];
  mappings: {
    id: string;
    supplierProduct: {
      id: string;
      name: string | null;
      price: string | null;
      status: Product['status'];
      supplier: string;
      externalId: string;
    };
  }[];
}

export interface ChangeLog {
  id: string;
  field: string;
  previousValue: string;
  newValue: string;
  createdAt: string;
  supplierProduct: { name: string | null };
}

export interface Dashboard {
  productCount: number;
  recentChangeCount: number;
  days: number;
}
