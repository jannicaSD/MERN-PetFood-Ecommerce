import React, { useContext, useMemo, useState } from 'react';
import { axios } from '../Utils/Axios';
import { PetContext } from '../Context/Context';
import '../Styles/Chatbot.css';

const starterMessage = {
  role: 'assistant',
  content: 'Hi! I am your Pet Food Assistant. Ask me about products, feeding, or your order steps.',
};

const quickActions = [
  { label: 'Dog food under 1000', prompt: 'dog food under 1000' },
  { label: 'Cat food under 1000', prompt: 'cat food under 1000' },
  { label: 'My cat is allergic to fish', prompt: 'my cat is allergic to fish' },
  { label: 'Avoid chicken', prompt: 'dog food without chicken' },
];

const getLocalFallbackReply = (message) => {
  const query = message.toLowerCase();

  if (query.includes('dog')) {
    return 'For dogs, choose food by age, breed size, and protein level. Check the Dog Food section for suitable options.';
  }

  if (query.includes('cat')) {
    return 'For cats, choose taurine-rich food and browse the Cat Food section for the best match.';
  }

  if (query.includes('order') || query.includes('delivery') || query.includes('track')) {
    return 'For order help, open Orders after login and check payment status there.';
  }

  if (query.includes('price') || query.includes('discount') || query.includes('offer')) {
    return 'You can compare prices on the Products page and check top-selling items for value picks.';
  }

  return 'I can help with product suggestions, feeding basics, checkout help, and order guidance. Ask me a specific question.';
};

const formatMoney = (price) => `Rs. ${Number(price).toLocaleString('en-IN')}`;

const ALLERGEN_ALIASES = {
  fish: ['fish', 'salmon', 'tuna'],
  chicken: ['chicken', 'poultry'],
  beef: ['beef'],
  milk: ['milk', 'dairy', 'lactose'],
  grain: ['grain', 'wheat', 'corn', 'maize', 'soy'],
  egg: ['egg'],
  sunflower: ['sunflower', 'sunflower oil', 'shunflower', 'shunflower oil'],
};

const STOP_WORDS = [
  'a',
  'an',
  'and',
  'or',
  'the',
  'is',
  'are',
  'am',
  'any',
  'there',
  'ther',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'you',
  'your',
  'we',
  'our',
  'it',
  'can',
  'could',
  'would',
  'should',
  'please',
  'hi',
  'hello',
  'hey',
  'what',
  'which',
  'who',
  'where',
  'when',
  'how',
  'dog',
  'cat',
  'food',
  'foods',
  'price',
  'prices',
  'product',
  'products',
  'under',
  'over',
  'below',
  'above',
  'more',
  'less',
  'than',
  'upto',
  'up',
  'budget',
  'average',
  'avg',
  'mean',
  'cost',
  'amount',
  'range',
  'between',
  'around',
  'within',
  'inr',
  'rs',
  'cheap',
  'show',
  'find',
  'list',
  'best',
  'allergic',
  'allergy',
  'ingredient',
  'ingredients',
  'avoid',
  'with',
  'without',
  'has',
  'my',
  'to',
];

const normalizeAllergyToken = (token) => {
  const cleaned = String(token || '').toLowerCase().trim();
  if (!cleaned) {
    return null;
  }

  const entry = Object.entries(ALLERGEN_ALIASES).find(([, aliases]) => aliases.some((alias) => cleaned === alias || cleaned.includes(alias)));
  return entry ? entry[0] : cleaned;
};

const extractAllergyTerms = (query) => {
  const matches = [];
  const phrases = [
    /allergic to\s+([^.,!?]+)/,
    /allergy to\s+([^.,!?]+)/,
    /avoid\s+([^.,!?]+)/,
    /without\s+([^.,!?]+)/,
  ];

  phrases.forEach((pattern) => {
    const found = query.match(pattern);
    if (found?.[1]) {
      matches.push(found[1]);
    }
  });

  const directWords = Object.values(ALLERGEN_ALIASES)
    .flat()
    .filter((word) => query.includes(word));

  const fromPhrase = matches
    .join(' ')
    .split(/,|\band\b|\bor\b/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .map((part) => normalizeAllergyToken(part))
    .filter((term) => Boolean(term) && !['oil', 'ingredient', 'ingredients', 'food'].includes(term));

  const fromWords = directWords
    .map((part) => normalizeAllergyToken(part))
    .filter(Boolean);

  return [...new Set([...fromPhrase, ...fromWords])];
};

const parseAmountToken = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/inr|rs\.?|₹/g, '').replace(/,/g, '').trim();
  const hasK = normalized.endsWith('k');
  const numericPart = hasK ? normalized.slice(0, -1) : normalized;
  const amount = Number(numericPart);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return hasK ? amount * 1000 : amount;
};

const getPriceFilters = (query) => {
  const underPattern = /(?:under|below|less than|upto|up to|within)\s*(?:rs\.?|₹|inr)?\s*([\d,.]+\s*k?)/;
  const overPattern = /(?:over|above|more than)\s*(?:rs\.?|₹|inr)?\s*([\d,.]+\s*k?)/;

  const underMatch = query.match(underPattern);
  const overMatch = query.match(overPattern);

  return {
    max: parseAmountToken(underMatch?.[1]),
    min: parseAmountToken(overMatch?.[1]),
  };
};

const buildProductFilterReply = (message, products = []) => {
  const query = String(message || '').toLowerCase();
  const hasProductIntent =
    query.includes('product') ||
    query.includes('food') ||
    query.includes('dog') ||
    query.includes('cat') ||
    query.includes('price') ||
    query.includes('under') ||
    query.includes('below') ||
    query.includes('cheap') ||
    query.includes('allergic') ||
    query.includes('allergy') ||
    query.includes('avoid') ||
    query.includes('without');

  if (!hasProductIntent || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  let filtered = [...products];

  if (query.includes('dog')) {
    filtered = filtered.filter((item) => String(item.category || '').toLowerCase().includes('dog'));
  }

  if (query.includes('cat')) {
    filtered = filtered.filter((item) => String(item.category || '').toLowerCase().includes('cat'));
  }

  const { min, max } = getPriceFilters(query);

  if (Number.isFinite(max)) {
    filtered = filtered.filter((item) => Number.isFinite(Number(item.price)) && Number(item.price) <= max);
  }

  if (Number.isFinite(min)) {
    filtered = filtered.filter((item) => Number.isFinite(Number(item.price)) && Number(item.price) >= min);
  }

  const allergyTerms = extractAllergyTerms(query);
  if (allergyTerms.length > 0) {
    filtered = filtered.filter((item) => {
      const ingredientText = `${item.ingredients || ''} ${item.allergens || ''} ${item.description || ''}`.toLowerCase();
      return !allergyTerms.some((term) => ingredientText.includes(term));
    });
  }

  const keywords = query
    .replace(/[^a-z0-9\s₹.,]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.includes(word) &&
        !/^\d+(?:\.\d+)?k?$/.test(word.replace(/,/g, ''))
    );

  const searchableKeywords = keywords.filter((word) => !allergyTerms.includes(normalizeAllergyToken(word)));

  const hasPriceConstraint = Number.isFinite(min) || Number.isFinite(max);
  const hasAverageIntent = query.includes('average') || query.includes('avg') || query.includes('mean');
  const shouldApplyKeywordFilter = searchableKeywords.length > 0 && (!hasPriceConstraint || searchableKeywords.length > 1 || hasAverageIntent);

  if (shouldApplyKeywordFilter) {
    filtered = filtered.filter((item) => {
      const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
      return searchableKeywords.some((keyword) => text.includes(keyword));
    });
  }

  if (filtered.length === 0) {
    if (allergyTerms.length > 0) {
      return `I could not find a safe match after excluding: ${allergyTerms.join(', ')}. Try broadening your filters or changing budget.`;
    }

    return 'I could not find matching products for that filter. Try a broader query like "dog food under 1000".';
  }

  const pricedItems = filtered.filter((item) => Number.isFinite(Number(item.price)));
  if (hasAverageIntent && pricedItems.length > 0) {
    const total = pricedItems.reduce((sum, item) => sum + Number(item.price), 0);
    const avgPrice = Math.round(total / pricedItems.length);
    const exampleLines = pricedItems
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 3)
      .map((item, index) => `${index + 1}. ${item.title} - ${formatMoney(item.price)}`);

    const filterSummary = [];
    if (Number.isFinite(max)) {
      filterSummary.push(`under ${formatMoney(max)}`);
    }
    if (Number.isFinite(min)) {
      filterSummary.push(`above ${formatMoney(min)}`);
    }

    const summaryText = filterSummary.length > 0 ? ` (${filterSummary.join(' and ')})` : '';
    return `The average price${summaryText} is ${formatMoney(avgPrice)} across ${pricedItems.length} products.\n${exampleLines.join('\n')}`;
  }

  const sortedItems = [...filtered].sort((a, b) => Number(a.price) - Number(b.price));
  const topItems = sortedItems.slice(0, 5);
  const lines = topItems.map((item, index) => `${index + 1}. ${item.title} - ${formatMoney(item.price)}`);

  if (Number.isFinite(max) || Number.isFinite(min)) {
    const labelParts = [];
    if (Number.isFinite(max)) {
      labelParts.push(`under ${formatMoney(max)}`);
    }
    if (Number.isFinite(min)) {
      labelParts.push(`above ${formatMoney(min)}`);
    }

    const priceLabel = labelParts.join(' and ');
    return `I found ${filtered.length} products ${priceLabel}.\n${lines.join('\n')}`;
  }

  if (allergyTerms.length > 0) {
    return `Here are safer matches after avoiding: ${allergyTerms.join(', ')}.\n${lines.join('\n')}`;
  }

  return `Here are matching products:\n${lines.join('\n')}`;
};

function ChatbotWidget() {
  const { products } = useContext(PetContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([starterMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  const sendQuickAction = (prompt) => {
    setInput(prompt);
    setTimeout(() => {
      const syntheticEvent = { preventDefault: () => {} };
      handleSend(prompt, syntheticEvent);
    }, 0);
  };

  const handleSend = async (overrideMessage, event) => {
    event?.preventDefault?.();

    const trimmed = String(overrideMessage ?? input).trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    const filteredReply = buildProductFilterReply(trimmed, products);
    if (filteredReply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: filteredReply }]);
      setIsLoading(false);
      return;
    }

    try {
      const history = nextMessages.slice(-8).map((item) => ({ role: item.role, content: item.content }));
      const { data } = await axios.post('/api/users/chatbot', { message: trimmed, history });
      const assistantMessage = { role: 'assistant', content: data.reply || 'I could not generate a response right now.' };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: getLocalFallbackReply(trimmed),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-root">
      {isOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-copy">
              <span className="chatbot-badge">AI Assistant</span>
              <strong>Pet Assistant</strong>
              <p>Find products, compare prices, and filter by allergy.</p>
            </div>
            <button type="button" className="chatbot-close" aria-label="Close chat" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="chatbot-quick-actions">
            {quickActions.map((action) => (
              <button key={action.label} type="button" className="chatbot-chip" onClick={() => sendQuickAction(action.prompt)}>
                {action.label}
              </button>
            ))}
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={`${msg.role}-${index}`} className={`chatbot-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isLoading && <div className="chatbot-message assistant">Typing...</div>}
          </div>
          <div className="chatbot-input-wrap">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about pet food, pricing, or order help..."
              rows={2}
            />
            <div className="chatbot-input-actions">
              <button type="button" className="chatbot-secondary" onClick={() => setInput('')} disabled={!input}>
                Clear
              </button>
              <button type="button" className="chatbot-primary" onClick={handleSend} disabled={!canSend}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      <button type="button" className="chatbot-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <span className="chatbot-toggle-dot" />
        {isOpen ? 'Close Chat' : 'Chat With Us'}
      </button>
    </div>
  );
}

export default ChatbotWidget;
