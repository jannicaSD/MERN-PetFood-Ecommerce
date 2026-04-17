import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PetContext } from '../Context/Context';
import { MDBIcon } from 'mdb-react-ui-kit';
import toast from 'react-hot-toast';
import Loading from './Loading';

function ProductList({ products }) {
  const navigate = useNavigate();
  const { loginStatus, handlePrice, wishlist, addToWishlist, removeFromWishlist } = useContext(PetContext);
  const safeProducts = Array.isArray(products) ? products : [];

  if (safeProducts.length === 0) {
    return <Loading />;
  }

  return (
    <div className="product-content">
      {safeProducts.map((value) => {
        const isWishlisted = wishlist.some((item) => item._id === value._id);

        const handleWishlistClick = () => {
          if (value.source === 'openpetfoodfacts') {
            toast.error('Demo products are browse-only.');
            return;
          }

          if (isWishlisted) {
            removeFromWishlist(value._id);
            return;
          }

          loginStatus ? addToWishlist(value._id) : toast.error('Sign in to your account');
        };

        return (
          <article className="product-card" key={value._id}>
            <div className="product-card-media" onClick={() => navigate(`/products/${value._id}`)}>
              <img src={value.image} alt={value.title} />
              <span className="product-card-tag">{value.category || 'Pet'}</span>
            </div>
            <div className="product-card-body">
              <div className="product-card-head">
                <h3 onClick={() => navigate(`/products/${value._id}`)}>{value.title}</h3>
                <p>{String(value.description || '').slice(0, 92)}...</p>
              </div>

              <div className="product-card-footer">
                <div className="price-group">
                  <span className="price">{handlePrice(value.price)}</span>
                </div>

                <button type="button" className="details-button" onClick={() => navigate(`/products/${value._id}`)}>
                  View Details
                </button>
              </div>
            </div>
            <button type="button" className="heart product-heart" aria-label={`Wishlist ${value.title}`} onClick={handleWishlistClick}>
              <MDBIcon fas icon="heart" className={isWishlisted ? 'clicked-heart-icon' : 'heart-icon'} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default ProductList;
