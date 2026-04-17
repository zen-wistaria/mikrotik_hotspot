document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const initTheme = () => {
        const savedTheme = localStorage.getItem('hotspot-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    };

    const toggleTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('hotspot-theme', newTheme);
        updateThemeIcon(newTheme);
    };

    const updateThemeIcon = (theme) => {
        const icon = document.querySelector('.theme-toggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    };

    const themeToggleBtn = document.querySelector('.theme-toggle');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    initTheme();

    // Tab Management (Member vs Voucher)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginForm = document.querySelector('form[name="login"]');
    const passwordGroup = document.getElementById('password-group');
    const usernameLabel = document.getElementById('username-label');
    const loginTypeInput = document.getElementById('login-type'); // Hidden input if we want to track state

    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const type = btn.getAttribute('data-type');
                if (type === 'voucher') {
                    passwordGroup.style.display = 'none';
                    usernameLabel.textContent = 'Voucher Code';
                    document.login.username.placeholder = 'Enter Voucher Code';
                } else {
                    passwordGroup.style.display = 'block';
                    usernameLabel.textContent = 'Username';
                    document.login.username.placeholder = 'Enter Username';
                }
            });
        });
    }

    // Loading State
    if (loginForm) {
        loginForm.addEventListener('submit', () => {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab && activeTab.getAttribute('data-type') === 'voucher') {
                // For Voucher: copy username to password
                document.login.password.value = document.login.username.value;
            }
            
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'flex';
        });
    }

    // Session Timer (Status Page)
    const uptimeElement = document.getElementById('uptime');
    if (uptimeElement) {
        let seconds = parseUptime(uptimeElement.getAttribute('data-uptime') || '0s');
        setInterval(() => {
            seconds++;
            uptimeElement.textContent = formatUptime(seconds);
        }, 1000);
    }
});

// Helper: Parse MikroTik uptime string (e.g., 01:20:30 or 1h20m30s)
function parseUptime(uptimeStr) {
    if (uptimeStr.includes(':')) {
        const parts = uptimeStr.split(':').reverse();
        return (parseInt(parts[0]) || 0) + 
               (parseInt(parts[1]) || 0) * 60 + 
               (parseInt(parts[2]) || 0) * 3600 +
               (parseInt(parts[3]) || 0) * 86400;
    }
    // Handle days, hours, minutes, seconds format (1d2h3m4s)
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
    
    let res = "";
    if (d > 0) res += d + "d ";
    if (h > 0 || d > 0) res += (h < 10 ? "0" + h : h) + ":";
    res += (m < 10 ? "0" + m : m) + ":";
    res += (s < 10 ? "0" + s : s);
    return res;
}
