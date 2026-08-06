document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('shared-nav');
    if (!placeholder) return;

    placeholder.innerHTML = `
        <header class="top-nav">
            <a class="top-nav__brand" href="index.html">MD apps</a>
            <button class="hamburger" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="primary-nav">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <nav id="primary-nav" class="top-nav__menu" aria-label="Primary navigation">
                <a href="index.html">Home</a>
                <div class="top-nav__dropdown">
                    <button class="dropdown__toggle" type="button" aria-expanded="false">WebRTC</button>
                    <div class="dropdown__menu" role="menu">
                        <a href="webrtcmanual.html">Manual Chat</a>
                        <a href="webrtcpeer.html">PeerJS Chat</a>
                        <a href="webrtcpersistent.html">Auto-Reconnect</a>
                        <a href="webrtc-logs.html">Debug Logs</a>
                    </div>
                </div>
                <a href="console.html">JS Console</a>
                <a href="json_escaper.html">JSON Escaper</a>
                <a href="https://sharebyair.com/" target="_blank" rel="noopener noreferrer">Shareby Air</a>
                <a href="https://zoryn.ai/" target="_blank" rel="noopener noreferrer">Zoryn AI</a>
                <a href="tel:+14085331493">Voice Agent</a>
            </nav>
        </header>
    `;

    const hamburger = placeholder.querySelector('.hamburger');
    const menu = placeholder.querySelector('.top-nav__menu');

    if (hamburger && menu) {
        hamburger.addEventListener('click', () => {
            const isOpen = menu.classList.toggle('is-open');
            hamburger.setAttribute('aria-expanded', String(isOpen));
            if (!isOpen) {
                placeholder.querySelectorAll('.dropdown__menu.is-open').forEach(p => p.classList.remove('is-open'));
                placeholder.querySelectorAll('.dropdown__toggle[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
            }
        });

        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                menu.classList.remove('is-open');
                hamburger.setAttribute('aria-expanded', 'false');
                placeholder.querySelectorAll('.dropdown__menu.is-open').forEach(p => p.classList.remove('is-open'));
                placeholder.querySelectorAll('.dropdown__toggle[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
            });
        });

        // Dropdown toggle behavior
        placeholder.querySelectorAll('.dropdown__toggle').forEach((toggle) => {
            const panel = toggle.nextElementSibling;
            // prevent clicks from bubbling to document handler
            toggle.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const isOpen = panel.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', String(isOpen));
            });

            // Close on Escape when toggle is focused
            toggle.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape' || ev.key === 'Esc') {
                    panel.classList.remove('is-open');
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.blur();
                }
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (ev) => {
            if (!placeholder.contains(ev.target)) {
                placeholder.querySelectorAll('.dropdown__menu.is-open').forEach(p => p.classList.remove('is-open'));
                placeholder.querySelectorAll('.dropdown__toggle[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
                if (menu.classList.contains('is-open') === false) {
                    // nothing else
                }
            }
        });

        // Close dropdowns on Escape globally
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' || ev.key === 'Esc') {
                placeholder.querySelectorAll('.dropdown__menu.is-open').forEach(p => p.classList.remove('is-open'));
                placeholder.querySelectorAll('.dropdown__toggle[aria-expanded="true"]').forEach(t => t.setAttribute('aria-expanded', 'false'));
            }
        });
    }
});
