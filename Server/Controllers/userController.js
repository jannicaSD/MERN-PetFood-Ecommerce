const { User, userRegisterSchema, userLoginSchema } = require('../Models/userSchema');
const { Product } = require('../Models/productSchema');
const Order = require('../Models/orderSchema');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
let orderDetails = {};

const getFallbackReply = (message) => {
  const query = message.toLowerCase();

  if (query.includes('dog')) {
    return 'For dogs, start with high-protein options and choose food based on age and size. You can browse the Dog Food section in this store.';
  }

  if (query.includes('cat')) {
    return 'For cats, choose taurine-rich food and filter by life stage. Check the Cat Food section to compare options.';
  }

  if (query.includes('order') || query.includes('delivery') || query.includes('track')) {
    return 'For order help: login, open Orders page, and verify payment status there. If payment failed, retry checkout from cart.';
  }

  if (query.includes('price') || query.includes('discount') || query.includes('offer')) {
    return 'You can compare product prices on the Products page and check top-selling items for value picks.';
  }

  return 'I can help with product suggestions, feeding basics, checkout issues, and order guidance. Ask a specific question and I will guide you.';
};

const generateChatReply = async (message, history = []) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    return getFallbackReply(message);
  }

  // Use Gemini if API key is present
  if (geminiKey) {
    return generateGeminiReply(message, history, geminiKey);
  }

  // Fallback to OpenAI
  return generateOpenAIReply(message, history, openaiKey);
};

const generateGeminiReply = async (message, history = [], apiKey) => {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const systemPrompt =
    'You are a concise and helpful assistant for a pet-food ecommerce website. Give practical and safe guidance in short paragraphs.';

  const formattedHistory = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
    .slice(-8);

  // Build Gemini conversation format
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
    {
      role: 'model',
      parts: [{ text: 'Understood. I will be concise and helpful for pet-food ecommerce.' }],
    },
    ...formattedHistory.map((item) => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(item.content) }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      return getFallbackReply(message);
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || getFallbackReply(message);
  } catch (error) {
    return getFallbackReply(message);
  }
};

const generateOpenAIReply = async (message, history = [], apiKey) => {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt =
    'You are a concise and helpful assistant for a pet-food ecommerce website. Give practical and safe guidance in short paragraphs.';

  const formattedHistory = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
    .slice(-8)
    .map((item) => ({ role: item.role, content: String(item.content) }));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [{ role: 'system', content: systemPrompt }, ...formattedHistory, { role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      return getFallbackReply(message);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    return reply || getFallbackReply(message);
  } catch (error) {
    return getFallbackReply(message);
  }
};

module.exports = {
  register: async (req, res) => {
    const { error, value } = userRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, email, password } = value;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful! You can now login.',
    });
  },

  login: async (req, res) => {
    const { error, value } = userLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { email, password } = value;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email not found. Please register.' });
    }

    const passwordMatch = bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Incorrect Password. Try again.' });
    }

    const accessToken = jwt.sign({ email }, process.env.USER_ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
    const refreshToken = jwt.sign({ email }, process.env.USER_REFRESH_TOKEN_SECRET, { expiresIn: '3d' });

    res
      .status(200)
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        maxAge: 3 * 24 * 60 * 60 * 1000,
      })
      .json({
        status: 'success',
        message: 'Successfully Logged In.',
        data: { jwt_token: accessToken, name: user.name, userID: user._id },
      });
  },

  getAllProducts: async (req, res) => {
    const products = await Product.find();
    if (products.length == 0) {
      return res.json({ message: 'Product collection is empty!' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products detail.',
      data: products,
    });
  },

  getProductById: async (req, res) => {
    const productID = req.params.id;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched product details.',
      data: product,
    });
  },

  getTopSellingProducts: async (req, res) => {
    const DogFood = await Product.find({ category: 'Dog' }).limit(4);
    const CatFood = await Product.find({ category: 'Cat' }).limit(4);
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products.',
      data: [...DogFood, ...CatFood],
    });
  },

  getProductsByCategory: async (req, res) => {
    const category = req.params.categoryname;
    const products = await Product.find({ category });
    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched products details.',
      data: products,
    });
  },

  showCart: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched cart items.',
      data: user.cart,
    });
  },

  addToCart: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { productID } = req.body;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await User.findByIdAndUpdate(userID, { $addToSet: { cart: { product: productID } } });

    res.status(200).json({
      status: 'success',
      message: 'Product added to cart',
      cart: user.cart,
    });
  },

  updateCartItemQuantity: async (req, res) => {
    const userID = req.params.id;
    const { id, quantityChange } = req.body;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedCart = (user.cart.id(id).quantity += quantityChange);
    if (updatedCart > 0) {
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Cart item quantity updated',
      data: user.cart,
    });
  },

  removeFromCart: async (req, res) => {
    const userID = req.params.id;
    const productID = req.params.product;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(userID, { $pull: { cart: { product: productID } } });
    res.status(200).json({
      status: 'success',
      message: 'Successfully removed from cart',
    });
  },

  showWishlist: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID).populate('wishlist');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched wishlist.',
      data: user.wishlist,
    });
  },

  addToWishlist: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { productID } = req.body;
    const product = await Product.findById(productID);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(userID, { $addToSet: { wishlist: productID } }, { new: true });
    res.status(200).json({
      status: 'success',
      message: 'Successfully added to wishlist',
      data: updatedUser.wishlist,
    });
  },

  removeFromWishlist: async (req, res) => {
    const userID = req.params.id;
    const productID = req.params.product;

    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(userID, { $pull: { wishlist: productID } });
    res.status(200).json({
      status: 'success',
      message: 'Successfully removed from wishlist',
    });
  },

  payment: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID).populate('cart.product');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.cart.length === 0) {
      return res.status(404).json({ message: 'Cart is empty' });
    }

    const line_items = user.cart.map((item) => {
      return {
        price_data: {
          currency: 'inr',
          product_data: {
            images: [item.product.image],
            name: item.product.title,
          },
          unit_amount: Math.round(item.product.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: 'payment',
      success_url: 'http://localhost:3000/payment/success',
      cancel_url: 'http://localhost:3000/payment/cancel',
    });

    orderDetails = {
      userID,
      user,
      newOrder: {
        products: user.cart.map((item) => new mongoose.Types.ObjectId(item.product._id)),
        order_id: Date.now(),
        payment_id: session.id,
        total_amount: session.amount_total / 100,
      },
    };

    res.status(200).json({
      status: 'success',
      message: 'Stripe Checkout session created',
      sessionId: session.id,
      url: session.url,
    });
  },

  success: async (req, res) => {
    const { userID, user, newOrder } = orderDetails;

    if (newOrder) {
      const order = await Order.create({ ...newOrder });
      await User.findByIdAndUpdate(userID, { $push: { orders: order._id } });
      orderDetails.newOrder = null;
    }
    user.cart = [];
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Payment was successful',
    });
  },

  cancel: async (req, res) => {
    res.status(200).json({
      status: 'failure',
      message: 'Payment was cancelled',
    });
  },

  showOrders: async (req, res) => {
    const userID = req.params.id;
    const user = await User.findById(userID).populate('orders');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userOrders = user.orders;
    if (userOrders.length === 0) {
      return res.status(404).json({ message: 'You have no orders' });
    }

    const orderDetails = await Order.find({ _id: { $in: userOrders } }).populate('products');

    res.status(200).json({
      status: 'success',
      message: 'Successfully fetched order details.',
      data: orderDetails,
    });
  },

  chatbotReply: async (req, res) => {
    const { message, history } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const reply = await generateChatReply(String(message).trim(), Array.isArray(history) ? history : []);

    res.status(200).json({
      status: 'success',
      reply,
    });
  },
};
