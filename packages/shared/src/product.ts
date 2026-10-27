export interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
  status: 'ACTIVE' | 'SOLD_OUT' | 'DISCONTINUED';
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Product {
  mappings: {
    id: string;
    supplierProduct: {
      id: string;
      name: string;
      price: string;
      status: Product['status'];
      supplier: string;
      externalId: string;
    };
  }[];
}

export interface ChangeLog {
  id: string;
  field: 'PRICE' | 'STATUS' | 'NAME';
  previousValue: string;
  newValue: string;
  createdAt: string;
  supplierProduct: { name: string; isSample: boolean };
}

export interface Dashboard {
  productCount: number;
  recentChangeCount: number;
  days: number;
}
