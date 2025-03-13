document.addEventListener('DOMContentLoaded', () => {
    // Gestionnaire de défilement pour la navbar
    const navbar = document.querySelector('.navbar');
    const scrollThreshold = 50;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > scrollThreshold) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Détection de la page active pour la navigation
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (currentPath.includes(linkPath) && linkPath !== '/') {
            link.classList.add('active');
        } else if (currentPath === '/' && linkPath === 'kaso-final.html') {
            link.classList.add('active');
        }
    });
    
    // Fonctionnalité de connexion Discord
    const connectBtn = document.querySelector('.connect-btn');
    const discordLogin = document.getElementById('discord-login');
    const userProfileContainer = document.createElement('div');
    userProfileContainer.className = 'user-profile-container';
    
    // Vérifier si l'utilisateur est déjà connecté (token stocké dans localStorage)
    checkDiscordLoginStatus();
    
    function checkDiscordLoginStatus() {
        // Vérifier si un token est stocké dans localStorage et s'il n'est pas expiré
        const discordUser = JSON.parse(localStorage.getItem('discordUser') || 'null');
        const expiry = localStorage.getItem('discordTokenExpiry');
        const hasValidSession = discordUser && expiry && new Date().getTime() < parseInt(expiry);
        
        if (hasValidSession && connectBtn) {
            // Modifier le bouton pour afficher le profil utilisateur
            displayUserProfile(discordUser);
        }
        
        // Gérer les paramètres de l'URL après redirection OAuth
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = urlParams.get('access_token');
        const tokenType = urlParams.get('token_type');
        
        if (accessToken) {
            // Nettoyer l'URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Récupérer les informations de l'utilisateur
            fetchDiscordUserInfo(accessToken, tokenType);
        }
    }
    
    function fetchDiscordUserInfo(accessToken, tokenType) {
        fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `${tokenType} ${accessToken}`
            }
        })
        .then(response => response.json())
        .then(userData => {
            // Stocker les informations utilisateur et le token pendant 1 jour
            const expiry = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 heures
            localStorage.setItem('discordUser', JSON.stringify(userData));
            localStorage.setItem('discordToken', accessToken);
            localStorage.setItem('discordTokenExpiry', expiry.toString());
            
            // Afficher le profil utilisateur
            displayUserProfile(userData);
            
            // Ajouter une animation de notification de connexion réussie
            showLoginSuccessNotification(userData.username);
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des informations Discord:', error);
            showErrorNotification("Impossible de récupérer vos informations Discord");
        });
    }
    
    function displayUserProfile(userData) {
        if (!connectBtn) return;
        
        // Création de l'élément d'affichage du profil
        const avatarUrl = userData.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        userProfileContainer.innerHTML = `
            <div class="user-avatar">
                <img src="${avatarUrl}" alt="${userData.username}">
            </div>
            <div class="user-info">
                <span class="username">${userData.username}</span>
                <button class="logout-btn">Déconnexion</button>
            </div>
        `;
        
        // Remplacer le bouton de connexion par le profil utilisateur
        connectBtn.style.display = 'none';
        connectBtn.parentNode.insertBefore(userProfileContainer, connectBtn.nextSibling);
        
        // Ajouter gestionnaire d'événements pour la déconnexion
        const logoutBtn = userProfileContainer.querySelector('.logout-btn');
        logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logoutFromDiscord();
        });
    }
    
    function logoutFromDiscord() {
        // Supprimer les informations de session
        localStorage.removeItem('discordUser');
        localStorage.removeItem('discordToken');
        localStorage.removeItem('discordTokenExpiry');
        
        // Restaurer l'affichage du bouton de connexion
        connectBtn.style.display = 'flex';
        if (userProfileContainer.parentNode) {
            userProfileContainer.parentNode.removeChild(userProfileContainer);
        }
        
        // Afficher notification de déconnexion
        showNotification("Vous avez été déconnecté", "info");
    }
    
    function showLoginSuccessNotification(username) {
        showNotification(`Bienvenue, ${username}! Connexion réussie`, "success");
    }
    
    function showErrorNotification(message) {
        showNotification(message, "error");
    }
    
    function showNotification(message, type = "info") {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}
            </div>
            <div class="notification-message">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Suppression automatique
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
    
    if (connectBtn && discordLogin) {
        const discordLoginClose = document.getElementById('discord-login-close');
        
        connectBtn.addEventListener('click', () => {
            discordLogin.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        if (discordLoginClose) {
            discordLoginClose.addEventListener('click', () => {
                discordLogin.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        }
        
        // Fermer le modal en cliquant en dehors de la carte
        discordLogin.addEventListener('click', (e) => {
            if (e.target === discordLogin) {
                discordLogin.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    }
    
    // FAQ Toggle functionality
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        
        if (question && answer) {
            question.addEventListener('click', () => {
                const isOpen = answer.style.display === 'block';
                
                // Fermer tous les autres éléments ouverts
                faqItems.forEach(otherItem => {
                    const otherAnswer = otherItem.querySelector('.faq-answer');
                    const otherPlus = otherItem.querySelector('.faq-question .plus');
                    
                    if (otherItem !== item && otherAnswer.style.display === 'block') {
                        otherAnswer.style.display = 'none';
                        if (otherPlus) otherPlus.textContent = '+';
                    }
                });
                
                // Ouvrir/Fermer l'élément actuel
                answer.style.display = isOpen ? 'none' : 'block';
                const plus = question.querySelector('.plus');
                if (plus) plus.textContent = isOpen ? '+' : '-';
            });
        }
    });

    // Animation des feature cards au défilement
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.feature-card, .fade-in-up, .fade-in-down, .fade-in-left, .fade-in-right');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight * 0.85) {
                if (element.classList.contains('feature-card')) {
                    element.classList.add('active');
                } else {
                    element.style.animationPlayState = 'running';
                }
            }
        });
    };
    
    // Vérifier les positions au chargement
    animateOnScroll();
    
    // Vérifier les positions lors du défilement
    window.addEventListener('scroll', animateOnScroll);
    
    // Effet de survol amélioré pour les boutons
    const buttons = document.querySelectorAll('button, .join-btn, .other-btn, .card');
    const handleMouseMove = (e, element) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        element.style.setProperty('--x-pos', `${x}px`);
        element.style.setProperty('--y-pos', `${y}px`);
    };
    
    buttons.forEach(button => {
        button.addEventListener('mousemove', (e) => handleMouseMove(e, button));
        
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
            button.style.transition = 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '';
        });
    });
    
    // Créer les particules pour les pages qui ont un conteneur de particules
    const particlesContainer = document.getElementById('particles');
    
    if (particlesContainer) {
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = Math.random() * 3 + 'px';
            particle.style.height = particle.style.width;
            particle.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            particle.style.borderRadius = '50%';
            particle.style.top = Math.random() * 100 + 'vh';
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.opacity = Math.random() * 0.5;
            
            // Animation
            const duration = Math.random() * 20 + 10;
            particle.style.animation = `float ${duration}s infinite alternate`;
            particle.style.animationDelay = Math.random() * 5 + 's';
            
            particlesContainer.appendChild(particle);
        }
    }
    
    // Preloader
    const preloader = document.getElementById('preloader');
    if (preloader) {
        window.addEventListener('load', () => {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        });
    }
});
