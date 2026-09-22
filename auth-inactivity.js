const INACTIVITY_LIMIT = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];

export function startInactivityLogout(auth, signOutUser, onTimeout) {
    let timeoutId;

    const resetTimer = () => {
        clearTimeout(timeoutId);
        if (!auth.currentUser || auth.currentUser.isAnonymous) return;
        timeoutId = setTimeout(async () => {
            if (!auth.currentUser || auth.currentUser.isAnonymous) return;
            await signOutUser(auth);
            onTimeout();
        }, INACTIVITY_LIMIT);
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
        clearTimeout(timeoutId);
        ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
}
