import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { 
            getAuth, 
            createUserWithEmailAndPassword, 
            signInWithEmailAndPassword, 
            signOut, 
            onAuthStateChanged, 
            updateProfile 
        } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
        import { startInactivityLogout } from "./auth-inactivity.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCzcxTLAUH83sQsia4dPg5py19YzRsmw0o",
            authDomain: "remagstyle-43b41.firebaseapp.com",
            projectId: "remagstyle-43b41",
            messagingSenderId: "145831201308",
            appId: "1:145831201308:web:489a014516356f73a72dd9"
        };

        const ADMIN_UID = 'jDvJwjfMgoTU2oXXxmK2AwywrlN2';
        const ADMIN_EMAIL = 'admin@remagstyle.com';
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // UI Elements
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');
        const accountDrawer = document.getElementById('account-drawer');
        const accountOverlay = document.getElementById('account-overlay');
        const accountPanel = document.getElementById('account-panel');
        const openAccountBtn = document.getElementById('open-account-btn');
        const closeAccountBtn = document.getElementById('close-account-btn');
        const navUserStatus = document.getElementById('nav-user-status');
        const authErrorMsg = document.getElementById('auth-error-msg');
        const authSuccessToast = document.getElementById('auth-success-toast');
        let authErrorTimeout;
        let authSuccessTimeout;
        let stopInactivityLogout;

        const authFormsContainer = document.getElementById('auth-forms-container');
        const userDashboardContainer = document.getElementById('user-dashboard-container');

        const tabSigninBtn = document.getElementById('tab-signin-btn');
        const tabSignupBtn = document.getElementById('tab-signup-btn');
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const signoutBtn = document.getElementById('signout-btn');

        const userDisplayName = document.getElementById('user-display-name');
        const userDisplayEmail = document.getElementById('user-display-email');
        const orderForm = document.getElementById('order-form');
        const orderFormMessage = document.getElementById('order-form-message');
        const ordersList = document.getElementById('orders-list');
        const ordersLoading = document.getElementById('orders-loading');

        function showAuthError(message) {
            clearTimeout(authErrorTimeout);
            authErrorMsg.textContent = message;
            authErrorMsg.classList.remove('hidden');
            authErrorTimeout = setTimeout(() => {
                authErrorMsg.classList.add('hidden');
                authErrorMsg.textContent = '';
            }, 10000);
        }

        function showAuthSuccess(message) {
            clearTimeout(authSuccessTimeout);
            authSuccessToast.textContent = message;
            authSuccessToast.classList.remove('hidden');
            authSuccessTimeout = setTimeout(() => {
                authSuccessToast.classList.add('hidden');
                authSuccessToast.textContent = '';
            }, 10000);
        }

        function showOrderMessage(message, isError = false) {
            orderFormMessage.textContent = message;
            orderFormMessage.className = isError
                ? 'mt-3 p-3 text-[11px] bg-red-50 border border-red-200 text-red-700'
                : 'mt-3 p-3 text-[11px] bg-green-50 border border-green-200 text-green-700';
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>'"]/g, (character) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            })[character]);
        }

        async function loadOrders(user) {
            ordersLoading.textContent = 'Loading...';
            try {
                const ordersQuery = query(collection(db, 'orders'), where('userId', '==', user.uid));
                const snapshot = await getDocs(ordersQuery);
                const orders = snapshot.docs.map((orderDocument) => ({ id: orderDocument.id, ...orderDocument.data() }));
                orders.sort((first, second) => {
                    const firstDate = first.createdAt?.toMillis?.() || 0;
                    const secondDate = second.createdAt?.toMillis?.() || 0;
                    return secondDate - firstDate;
                });

                ordersLoading.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
                ordersList.innerHTML = orders.length
                    ? orders.map((order) => {
                        const date = order.createdAt?.toDate?.().toLocaleDateString() || 'Just submitted';
                        return `<article class="border border-brand-border bg-white p-4">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p class="text-[10px] uppercase tracking-[0.18em] text-brand-muted">${escapeHtml(order.orderNumber || 'Legacy order')}</p>
                                    <p class="text-[10px] tracking-[0.18em] uppercase text-brand-muted">${escapeHtml(order.garment)}</p>
                                    <h5 class="mt-1 font-serif text-xl text-brand-text">${escapeHtml(order.occasion)}</h5>
                                </div>
                                <span class="border border-brand-border px-2 py-1 text-[9px] tracking-[0.15em] uppercase text-brand-text">${escapeHtml(order.status)}</span>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-3 text-[11px] text-brand-muted">
                                <p>Submitted<br><span class="text-brand-text">${escapeHtml(date)}</span></p>
                                <p>Delivery<br><span class="text-brand-text">${escapeHtml(order.deliveryStatus)}</span></p>
                            </div>
                        </article>`;
                    }).join('')
                    : '<p class="border border-dashed border-brand-border p-4 text-xs text-brand-muted">No orders yet. Submit your first bespoke request above.</p>';
            } catch (error) {
                ordersLoading.textContent = '';
                ordersList.innerHTML = '<p class="border border-red-200 bg-red-50 p-4 text-xs text-red-700">We could not load your orders right now.</p>';
                console.error('Unable to load orders:', error);
            }
        }

        // Mobile Navigation
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = !mobileMenu.classList.contains('hidden');
            mobileMenu.classList.toggle('hidden', isOpen);
            mobileMenuBtn.setAttribute('aria-expanded', String(!isOpen));
        });

        mobileMenuLinks.forEach((link) => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });

        // Drawer Controls
        function isAdminUser(user) {
            return !!user && (user.uid === ADMIN_UID || user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        }

        async function openAccount() {
            await auth.authStateReady();
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                if (isAdminUser(auth.currentUser)) {
                    window.location.href = 'admin/index.html';
                    return;
                }
                window.location.href = 'client-dashboard.html';
                return;
            }
            accountDrawer.classList.remove('pointer-events-none');
            accountOverlay.classList.remove('opacity-0', 'pointer-events-none');
            accountOverlay.classList.add('opacity-100');
            accountPanel.classList.remove('translate-x-full');
        }

        function closeAccount() {
            accountOverlay.classList.remove('opacity-100');
            accountOverlay.classList.add('opacity-0', 'pointer-events-none');
            accountPanel.classList.add('translate-x-full');
            setTimeout(() => accountDrawer.classList.add('pointer-events-none'), 300);
        }

        openAccountBtn.addEventListener('click', () => openAccount());
        document.getElementById('order-now-btn').addEventListener('click', (event) => {
            event.preventDefault();
            openAccount();
        });
        closeAccountBtn.addEventListener('click', closeAccount);
        accountOverlay.addEventListener('click', closeAccount);

        // Tabs
        tabSigninBtn.addEventListener('click', () => {
            signinForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
        });

        tabSignupBtn.addEventListener('click', () => {
            signupForm.classList.remove('hidden');
            signinForm.classList.add('hidden');
        });

        // Sign Up
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim().toLowerCase();
            const password = document.getElementById('signup-password').value;
            const fname = document.getElementById('signup-fname').value;
            const lname = document.getElementById('signup-lname').value;

            if (email === ADMIN_EMAIL.toLowerCase()) {
                showAuthError('Use the admin login page for the administrator account.');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: `${fname} ${lname}` });
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    uid: userCredential.user.uid,
                    firstName: fname,
                    lastName: lname,
                    displayName: `${fname} ${lname}`,
                    email,
                    createdAt: serverTimestamp()
                });
                window.location.href = 'client-dashboard.html';
            } catch (error) {
                showAuthError(error.code === 'auth/email-already-in-use'
                    ? 'This email already has an account. Please use the Sign In tab.'
                    : error.message);
            }
        });

        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) {
                showOrderMessage('Please sign in before placing an order.', true);
                return;
            }

            const submitButton = orderForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            try {
                const orderNumber = `RS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
                await setDoc(doc(db, 'orders', orderNumber), {
                    orderNumber,
                    userId: user.uid,
                    customerEmail: user.email,
                    garment: document.getElementById('order-garment').value,
                    occasion: document.getElementById('order-occasion').value.trim(),
                    designBrief: document.getElementById('order-notes').value.trim(),
                    measurements: {
                        chest: Number(document.getElementById('measurement-chest').value),
                        waist: Number(document.getElementById('measurement-waist').value),
                        shoulder: Number(document.getElementById('measurement-shoulder').value),
                        length: Number(document.getElementById('measurement-length').value)
                    },
                    inspirationLinks: document.getElementById('order-inspiration').value.trim().split('\n').filter(Boolean),
                    status: 'Received',
                    deliveryStatus: 'To be confirmed',
                    createdAt: serverTimestamp()
                });
                orderForm.reset();
                showOrderMessage('Your order request has been received.');
                await loadOrders(user);
            } catch (error) {
                showOrderMessage('We could not submit your order. Please try again.', true);
                console.error('Unable to submit order:', error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Place Order Request';
            }
        });

        // Sign In
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signin-email').value.trim().toLowerCase();
            const password = document.getElementById('signin-password').value;

            if (email === ADMIN_EMAIL.toLowerCase()) {
                showAuthError('Use the admin login page for the administrator account.');
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (isAdminUser(userCredential.user)) {
                    await signOut(auth);
                    showAuthError('This account is reserved for the admin workspace.');
                    return;
                }
                window.location.href = 'client-dashboard.html';
            } catch (error) {
                showAuthError('Invalid email or password.');
            }
        });

        // Sign Out
        signoutBtn.addEventListener('click', () => signOut(auth));

        // Auth Listener
        onAuthStateChanged(auth, async (user) => {
            stopInactivityLogout?.();
            if (user && isAdminUser(user)) {
                await signOut(auth);
                window.location.href = 'admin/index.html';
                return;
            }
            if (user) {
                const name = user.displayName || user.email?.split('@')[0] || 'Client';
                navUserStatus.textContent = user.isAnonymous ? 'Sign In / Sign Up' : name.split(' ')[0];
                authFormsContainer.classList.add('hidden');
                userDashboardContainer.classList.remove('hidden');
                userDisplayName.textContent = `Welcome back, ${name}`;
                userDisplayEmail.textContent = user.email || 'Guest order session';
                loadOrders(user);
                if (!user.isAnonymous) {
                    stopInactivityLogout = startInactivityLogout(auth, signOut, () => {
                        closeAccount();
                        showAuthError('You were signed out after 30 minutes of inactivity.');
                    });
                }
            } else {
                navUserStatus.textContent = 'Sign In / Sign Up';
                authFormsContainer.classList.remove('hidden');
                userDashboardContainer.classList.add('hidden');
            }
        });

        setTimeout(() => {
            document.getElementById('hero-slide-custom').classList.add('hero-slide-hidden');
            document.getElementById('hero-slide-current').classList.remove('hero-slide-hidden');
        }, 7000);