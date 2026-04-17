import React, { useState, useContext } from 'react';
import { PetContext } from '../Context/Context';
import { useNavigate } from 'react-router-dom';
import {
  MDBContainer,
  MDBNavbar,
  MDBNavbarToggler,
  MDBNavbarNav,
  MDBNavbarLink,
  MDBIcon,
  MDBCollapse,
  MDBBadge,
} from 'mdb-react-ui-kit';
import '../Styles/Navbar.css';
import toast from 'react-hot-toast';

const Navbar = () => {
  const [searchInput, setSearchInput] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showCollapse, setShowCollapse] = useState(false);
  const { products, loginStatus, setLoginStatus, cart } = useContext(PetContext);
  const name = localStorage.getItem('name');
  const navigate = useNavigate();

  const toggleSearchBox = () => setShowSearchBox(!showSearchBox); // Toggle search box visibility
  const toggleNavbar = () => setShowCollapse(!showCollapse); // Toggle mobile navbar

  // Handle search input change
  const handleSearchChange = (event) => {
    const searchText = event.target.value;
    setSearchInput(searchText);

    if (searchText !== '') {
      const filtered = products?.filter((product) => product.title.toLowerCase().includes(searchText.toLowerCase()));
      setFilteredProducts(filtered.slice(0, 6));
    } else {
      setFilteredProducts([]);
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
    setShowCollapse(false);
  };

  const handleSearchNavigation = (productId) => {
    setFilteredProducts([]);
    setSearchInput('');
    navigate(`/products/${productId}`);
    setShowSearchBox(false);
  };

  return (
    <MDBNavbar expand="lg" className="nav-container">
      <MDBContainer fluid className="nav-inner">
        <div className="nav-left">
          <MDBNavbarToggler
            data-mdb-toggle="collapse"
            data-mdb-target="#navbarCollapse"
            aria-label="Toggle navigation"
            onClick={toggleNavbar}
            className="nav-toggler"
          >
            <MDBIcon icon="bars" fas />
          </MDBNavbarToggler>

          <button type="button" className="logo-button" onClick={() => navigate('/')}>
            <span className="logo-mark">K</span>
            <span className="logo-text">Kitter</span>
          </button>
        </div>

        <MDBCollapse navbar show={showCollapse} id="navbarCollapse" className="nav-collapse-panel">
          <MDBNavbarNav className="navbar-links">
            <MDBNavbarLink onClick={() => handleNavigation('/')}>Home</MDBNavbarLink>
            <MDBNavbarLink onClick={() => handleNavigation('/products')}>Products</MDBNavbarLink>
            <MDBNavbarLink onClick={() => handleNavigation('/cat-food')} className="nav-food">
              Cat Food
            </MDBNavbarLink>
            <MDBNavbarLink onClick={() => handleNavigation('/dog-food')} className="nav-food">
              Dog Food
            </MDBNavbarLink>
          </MDBNavbarNav>
        </MDBCollapse>

        <div className="navbar-actions">
          <button type="button" className="action-pill greeting-pill" onClick={() => !loginStatus && navigate('/login')}>
            <span className="action-label">Hello</span>
            <span className="action-value">{name ? name.split(' ')[0] : 'Sign In'}</span>
          </button>

          <div className="search-wrap">
            <button type="button" className="icon-button" onClick={toggleSearchBox} aria-label="Search products">
              <MDBIcon fas icon={showSearchBox ? 'times' : 'search'} />
            </button>

            {showSearchBox && (
              <div className="search-panel">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchInput}
                    onChange={handleSearchChange}
                  />
                </div>

                <ul className={`search-output ${filteredProducts.length > 0 ? 'show' : ''}`}>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <li key={product._id} className="search-item" onClick={() => handleSearchNavigation(product._id)}>
                        <span className="search-item-title">{product.title}</span>
                        <span className="search-item-meta">{product.category}</span>
                      </li>
                    ))
                  ) : (
                    <li className="search-empty">No matching products found.</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="icon-button profile-button" aria-label="Profile menu">
            <MDBIcon fas icon="user" />
            <div className="profile-container">
              <ul className="profile-list">
                {loginStatus ? (
                  <>
                    <li onClick={() => navigate('/orders')}>My Orders</li>
                    <li onClick={() => navigate('/wishlist')}>Wishlist</li>
                    <li
                      onClick={() => {
                        setLoginStatus(false);
                        localStorage.clear();
                        navigate('/');
                      }}
                    >
                      Log Out
                    </li>
                  </>
                ) : (
                  <li onClick={() => navigate('/login')}>Sign In</li>
                )}
              </ul>
            </div>
          </div>

          <button
            type="button"
            className="icon-button cart-button"
            onClick={() => {
              loginStatus ? navigate('/cart') : toast.error('Sign in to your account');
            }}
            aria-label="Cart"
          >
            <MDBIcon fas icon="shopping-cart" />
            {loginStatus && cart.length > 0 && (
              <MDBBadge color="danger" notification pill className="cart-badge">
                {cart.length}
              </MDBBadge>
            )}
          </button>
        </div>
      </MDBContainer>
    </MDBNavbar>
  );
};

export default Navbar;
