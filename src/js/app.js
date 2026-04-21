document.addEventListener('DOMContentLoaded', () => {
  // Theme Management
  const initTheme = () => {
    const savedTheme = localStorage.getItem('hotspot-theme') || 'dark';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    updateThemeIcon(savedTheme);
    updateBodyTheme(savedTheme);
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('hotspot-theme', newTheme);
    updateThemeIcon(newTheme);
    updateBodyTheme(newTheme);
  };

  const updateBodyTheme = (theme) => {
    if (theme === 'light') {
      document.body.classList.remove(
        'dark:bg-dark-primary',
        'dark:text-white',
        'bg-dark-primary',
        'text-white'
      );
      document.body.classList.add('bg-slate-50', 'text-slate-900');
    } else {
      document.body.classList.add('bg-dark-primary', 'text-white');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
    }
  };

  const updateThemeIcon = (theme) => {
    const iconContainer = document.querySelector('.theme-toggle');
    if (iconContainer) {
      if (theme === 'dark') {
        iconContainer.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.38.39-1.02 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.38-.38.38-1.02 0-1.41z"/></svg>';
      } else {
        iconContainer.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.12 22a10 10 0 0 1-7.143-3.047A10.11 10.11 0 0 1 2.25 12c0-5.561 4.506-10.035 10.04-10.035a9.91 9.91 0 0 1 7.074 2.935 1 1 0 0 1-.26 1.564 8.01 8.01 0 0 0-4.321 13.9 1 1 0 0 1 .42 1.43 9.94 9.94 0 0 1-3.083 2.136c-.328.14-.678.188-1 .188l-.001.011z"/></svg>';
      }
    }
  };

  const themeToggleBtn = document.querySelector('.theme-toggle');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  initTheme();

  // View Management (Portal vs Form)
  const initialView = document.getElementById('initial-view');
  const formView = document.getElementById('form-view');
  const btnAuthenticate = document.getElementById('btn-authenticate');
  const btnBack = document.getElementById('btn-back');

  const showLoginView = () => {
    if (initialView && formView) {
      initialView.classList.add('opacity-0', '-translate-x-10');
      setTimeout(() => {
        initialView.classList.add('hidden');
        formView.classList.remove('hidden');
        setTimeout(() => {
          formView.classList.remove('opacity-0', 'scale-95');
        }, 50);
      }, 300);
    }
  };

  const hideLoginView = () => {
    if (initialView && formView) {
      formView.classList.add('opacity-0', 'scale-95');
      setTimeout(() => {
        formView.classList.add('hidden');
        initialView.classList.remove('hidden');
        setTimeout(() => {
          initialView.classList.remove('opacity-0', '-translate-x-10');
        }, 50);
      }, 300);
    }
  };

  if (btnAuthenticate) btnAuthenticate.addEventListener('click', showLoginView);
  if (btnBack) btnBack.addEventListener('click', hideLoginView);

  // Tab Management (Member vs Voucher)
  const tabBtns = document.querySelectorAll('.tab-btn');
  const passwordGroup = document.getElementById('password-group');
  const usernameLabel = document.getElementById('username-label');
  const usernameInput = document.querySelector(
    'input[name="username"].input-field'
  );

  if (tabBtns.length > 0) {
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('data-active', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('data-active', 'true');

        const type = btn.getAttribute('data-type');
        if (type === 'member') {
          if (passwordGroup) passwordGroup.style.display = 'block';
          if (usernameLabel) usernameLabel.textContent = 'Username';
          if (usernameInput) usernameInput.placeholder = 'Enter Username';
        } else {
          if (passwordGroup) {
            passwordGroup.style.display = 'none';
            passwordGroup.querySelector('input').value = '';
          }
          if (usernameLabel) usernameLabel.textContent = 'Voucher Code';
          if (usernameInput) usernameInput.placeholder = 'Enter Voucher Code';
        }
      });
    });
  }

  // Price List Toggle
  const priceBtn = document.getElementById('price-btn');
  const priceList = document.getElementById('price-list');

  if (priceBtn && priceList) {
    priceBtn.addEventListener('click', () => {
      priceList.classList.toggle('hidden');
      // Add subtle animation or scroll if needed
      if (!priceList.classList.contains('hidden')) {
        priceList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Loading State & Login Prep
  const loginForm = document.querySelector('form[name="login"]');
  if (loginForm) {
    loginForm.addEventListener('submit', () => {
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.getAttribute('data-type') === 'voucher') {
        const passInput = loginForm.querySelector('input[name="password"]');
        const userVal = loginForm.querySelector('input[name="username"]').value;
        if (passInput) passInput.value = userVal;
      }

      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'flex';
    });
  }

  // Session Timer (Status Page)
  // const uptimeElement = document.getElementById('uptime');
  // if (uptimeElement) {
  //     let seconds = parseUptime(uptimeElement.getAttribute('data-uptime') || '0s');
  //     setInterval(() => {
  //         seconds++;
  //         uptimeElement.textContent = formatUptime(seconds);
  //     }, 1000);
  // }
});

function parseUptime(uptimeStr) {
  if (uptimeStr.includes(':')) {
    const parts = uptimeStr.split(':').reverse();
    return (
      (parseInt(parts[0]) || 0) +
      (parseInt(parts[1]) || 0) * 60 +
      (parseInt(parts[2]) || 0) * 3600 +
      (parseInt(parts[3]) || 0) * 86400
    );
  }
  let totalSeconds = 0;
  const days = uptimeStr.match(/(\d+)d/);
  const hours = uptimeStr.match(/(\d+)h/);
  const mins = uptimeStr.match(/(\d+)m/);
  const secs = uptimeStr.match(/(\d+)s/);

  if (days) totalSeconds += parseInt(days[1]) * 86400;
  if (hours) totalSeconds += parseInt(hours[1]) * 3600;
  if (mins) totalSeconds += parseInt(mins[1]) * 60;
  if (secs) totalSeconds += parseInt(secs[1]);

  return totalSeconds || 0;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  let res = '';
  if (d > 0) res += d + 'd ';
  if (h > 0 || d > 0) res += (h < 10 ? '0' + h : h) + ':';
  res += (m < 10 ? '0' + m : m) + ':';
  res += s < 10 ? '0' + s : s;
  return res;
}
