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
      document.body.classList.remove('dark:bg-black', 'dark:text-white', 'bg-black', 'text-white');
      document.body.classList.add('bg-white', 'text-black');
    } else {
      document.body.classList.add('bg-black', 'text-white');
      document.body.classList.remove('bg-white', 'text-black');
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
          '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }
  };

  const themeToggleBtn = document.querySelector('.theme-toggle');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  initTheme();
});
