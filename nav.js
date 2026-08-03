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
                <a href="webrtcmanual.html">Manual Chat</a>
                <a href="webrtcpeer.html">PeerJS Chat</a>
                <a href="webrtcpersistent.html">Auto-Reconnect</a>
                <a href="webrtc-logs.html">Debug Logs</a>
                <a href="console.html">JS Console</a>
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
        });

        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                menu.classList.remove('is-open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }
});
