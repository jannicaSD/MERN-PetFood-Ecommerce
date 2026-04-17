import React, { useContext } from 'react';
import ProductList from '../Components/ProductList';
import { PetContext } from '../Context/Context';
import '../Styles/Products.css';

export default function AllProducts() {
  const { products } = useContext(PetContext);
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <main className="catalog-page">
      <section className="catalog-hero">
        <div className="catalog-hero-copy">
          <span className="catalog-kicker">Open Pet Food Facts</span>
          <h1>
            Our <span>Products</span>
          </h1>
          <p>
            Explore a clean, modern catalog with product cards designed for fast browsing, clear pricing,
            and easy discovery.
          </p>
        </div>

        <div className="catalog-hero-stats">
          <div className="catalog-stat">
            <strong>{safeProducts.length}</strong>
            <span>Products loaded</span>
          </div>
          <div className="catalog-stat">
            <strong>Fast</strong>
            <span>Product search</span>
          </div>
          <div className="catalog-stat">
            <strong>Filtered</strong>
            <span>Dog and cat food</span>
          </div>
        </div>
      </section>

      <section className="catalog-section">
        <ProductList products={safeProducts} />
      </section>
    </main>
  );
}
