/* eslint-disable max-len */
// DOM Elements
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const themeToggle = document.getElementById('theme-toggle-btn');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const copyButtons = document.querySelectorAll('.copy-button');

// Theme Management
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');

if (currentTheme === 'dark' || (!currentTheme && prefersDarkScheme.matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
} else {
  document.documentElement.setAttribute('data-theme', 'light');
}

themeToggle.addEventListener('click', () => {
  let theme = 'light';

  if (document.documentElement.getAttribute('data-theme') === 'light') {
    theme = 'dark';
  }

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

// Mobile Sidebar Toggle
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.add('open');
  document.body.style.overflow = 'hidden';
});

sidebarClose.addEventListener('click', () => {
  sidebar.classList.remove('open');
  document.body.style.overflow = '';
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (
    window.innerWidth < 1024 &&
    sidebar.classList.contains('open') &&
    !sidebar.contains(e.target) &&
    e.target !== sidebarToggle
  ) {
    sidebar.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Highlight current page in navigation
const currentPage = window.location.pathname.split('/').pop();
const navLinks = document.querySelectorAll('.sidebar-nav a');

navLinks.forEach((link) => {
  if (link.getAttribute('href') === currentPage || (currentPage === '' && link.getAttribute('href') === 'index.html')) {
    link.classList.add('active');
  } else {
    link.classList.remove('active');
  }
});

// Copy Code Button Functionality
copyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const codeBlock = button.parentNode.querySelector('pre');

    if (codeBlock) {
      const code = codeBlock.textContent;
      navigator.clipboard
        .writeText(code)
        .then(() => {
          const originalText = button.innerHTML;
          button.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>';

          setTimeout(() => {
            button.innerHTML = originalText;
          }, 2000);
        })
        .catch((err) => {
          console.error('Failed to copy code: ', err);
        });
    }
  });
});

// Active link highlighting for scroll sections
const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.5,
};

if (document.querySelectorAll('section[id]').length > 0) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        const tocLink = document.querySelector(`.toc-link[href="#${id}"]`);

        if (tocLink) {
          document.querySelectorAll('.toc-link').forEach((link) => {
            link.classList.remove('active');
          });

          tocLink.classList.add('active');
        }
      }
    });
  }, observerOptions);

  document.querySelectorAll('section[id]').forEach((section) => {
    observer.observe(section);
  });
}
