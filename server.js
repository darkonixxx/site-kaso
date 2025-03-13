const express = require('express');
const path = require('path');
const stripe = require('stripe')('sk_test_51R1jZDQSLWQDrXWErazXCLaDF028yNhzwlBDmmwzDqUQtwTnbGpq7YtfzoYirfB0NueDZpDMlwuOvA8hvNTEvpVY00iz80yIoD');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 8000;

// Configuration Discord OAuth
const DISCORD_CLIENT_ID = '134922352466136715';
const DISCORD_CLIENT_SECRET = '5CtTbFKfUQeLBbRgKNigYglhQAEql5gk';
const REDIRECT_URI = 'http://localhost:8000/auth/callback';

// Middlewares
app.use(cors()); // Permettre les requêtes cross-origin
app.use(express.static(path.join(__dirname, '/')));
app.use(bodyParser.json());

// Configuration des sessions
app.use(session({
  secret: 'kaso-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 86400000 } // 24 heures
}));

// Middleware de journalisation pour le développement
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes principales
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'kaso-final.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'faq.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'support.html'));
});

app.get('/payment', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment.html'));
});

// Routes d'authentification Discord
app.get('/auth/discord', (req, res) => {
  const params = {
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email guilds'
  };
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${querystring.stringify(params)}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Code d\'autorisation manquant');
  }
  
  try {
    // Échanger le code contre un token d'accès
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      querystring.stringify({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify email guilds'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, token_type } = tokenResponse.data;
    
    // Récupérer les informations de l'utilisateur
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `${token_type} ${access_token}`
      }
    });
    
    // Enregistrer l'utilisateur dans la session
    req.session.user = userResponse.data;
    req.session.isLoggedIn = true;
    req.session.discord_token = access_token;
    
    console.log(`Utilisateur connecté: ${userResponse.data.username}#${userResponse.data.discriminator}`);
    
    // Rediriger l'utilisateur vers la page d'accueil
    res.redirect('/');
  } catch (error) {
    console.error('Erreur d\'authentification Discord:', error.response?.data || error.message);
    res.status(500).send('Erreur lors de l\'authentification Discord');
  }
});

// Récupérer les infos de l'utilisateur connecté
app.get('/api/me', (req, res) => {
  if (req.session.isLoggedIn && req.session.user) {
    res.json({
      isLoggedIn: true,
      user: req.session.user
    });
  } else {
    res.json({
      isLoggedIn: false,
      user: null
    });
  }
});

// Déconnexion
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// API Endpoint pour Stripe
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'eur', tier } = req.body;
    
    // Validation
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        error: 'Montant invalide',
        message: 'Le montant doit être un nombre positif'
      });
    }
    
    // Créer une intention de paiement
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency,
      metadata: {
        tier: tier || 'Standard'
      }
    });
    
    console.log(`Intention de paiement créée: ${paymentIntent.id} pour ${amount}€`);
    
    // Retourner le clientSecret à utiliser côté client
    res.json({ 
      clientSecret: paymentIntent.client_secret,
      amount: amount,
      tier: tier || 'Standard'
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'intention de paiement:', error.message);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      message: 'Une erreur est survenue lors de la création de l\'intention de paiement'
    });
  }
});

// Webhook pour recevoir les événements Stripe
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  let event;
  
  try {
    const sig = req.headers['stripe-signature'];
    // Pour les tests, on peut désactiver la vérification de signature
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
    
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // En mode développement/démonstration, on accepte sans vérifier la signature
      event = JSON.parse(req.body.toString());
      console.log('Mode développement: webhook reçu sans vérification de signature');
    }
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Gérer les différents événements
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`✅ Paiement réussi: ${paymentIntent.amount / 100}${paymentIntent.currency}`);
      // Ici vous pourriez mettre à jour votre base de données, envoyer un email, etc.
      break;
    case 'payment_intent.payment_failed':
      console.log(`❌ Paiement échoué: ${event.data.object.id}`);
      break;
    default:
      console.log(`Événement non géré: ${event.type}`);
  }
  
  res.json({received: true});
});

// Gestion des erreurs 404
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// Gestion des erreurs générales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, '500.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`
  ====================================
  🚀 Serveur Kaso démarré!
  📡 Accessible sur: http://localhost:${PORT}
  ✨ Authentification Discord activée! 
  ====================================
  `);
});
