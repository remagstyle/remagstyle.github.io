import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, setDoc, updateDoc, doc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
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
        const orderForm = document.getElementById('order-form');
        const orderFormMessage = document.getElementById('order-form-message');
        const ordersList = document.getElementById('orders-list');
        const ordersLoading = document.getElementById('orders-loading');
        const dashboardToast = document.getElementById('dashboard-toast');
        let toastTimeout;
        let stopInactivityLogout;
        const stepOne = document.getElementById('order-step-1');
        const stepTwo = document.getElementById('order-step-2');
        const customerName = document.getElementById('customer-name');
        const customerPhone = document.getElementById('customer-phone');
        const customerGender = document.getElementById('customer-gender');
        const garment = document.getElementById('order-garment');
        const stepTwoFields = stepTwo.querySelectorAll('input, select, textarea');
        const measurementGarments = ['Trousers', 'Shirts (Long & Short)', 'Suits', 'Kaftan/Agbada', 'Bridal Couture', 'Red Carpet Dresses', 'Prom Dress', 'Corset Dresses', 'Slit and Kaba'];
        const garmentOptions = {
            Male: ['Trousers', 'Shirts (Long & Short)', 'Suits', 'Kaftan/Agbada'],
            Female: ['Bridal Couture', 'Red Carpet Dresses', 'Prom Dress', 'Corset Dresses', 'Slit and Kaba'],
            Other: ['Custom Bespoke Design', 'Kente Ensemble', 'Evening Wear']
        };

        function updateGarmentOptions() {
            garment.innerHTML = '<option value="">Select a garment</option>';
            (garmentOptions[customerGender.value] || []).forEach((option) => {
                garment.insertAdjacentHTML('beforeend', `<option>${option}</option>`);
            });
        }

        function updateMeasurementFlow() {
            const usesMeasurementPage = measurementGarments.includes(garment.value);
            document.getElementById('dashboard-measurements-next-btn').classList.toggle('hidden', !usesMeasurementPage);
            document.getElementById('dashboard-submit-btn').classList.toggle('hidden', usesMeasurementPage);
        }

        stepTwoFields.forEach((field) => { field.disabled = true; });

        document.getElementById('dashboard-next-btn').addEventListener('click', () => {
            if (!customerName.reportValidity() || !customerPhone.reportValidity() || !customerGender.reportValidity()) return;
            updateGarmentOptions();
            stepTwoFields.forEach((field) => { field.disabled = false; });
            stepOne.classList.add('hidden');
            stepTwo.classList.remove('hidden');
        });
        document.getElementById('dashboard-back-btn').addEventListener('click', () => {
            stepTwoFields.forEach((field) => { field.disabled = true; });
            stepTwo.classList.add('hidden');
            stepOne.classList.remove('hidden');
        });
        customerGender.addEventListener('change', updateGarmentOptions);
        customerGender.addEventListener('change', updateMeasurementFlow);
        garment.addEventListener('change', updateMeasurementFlow);

        document.getElementById('dashboard-measurements-next-btn').addEventListener('click', async () => {
            if (!garment.reportValidity() || !document.getElementById('order-occasion').reportValidity() || !document.getElementById('order-notes').reportValidity()) return;
            try {
                sessionStorage.setItem('remagstyle-order-draft', JSON.stringify({
                    customerName: customerName.value.trim(),
                    customerPhone: customerPhone.value.trim(),
                    gender: customerGender.value,
                    garment: garment.value,
                    occasion: document.getElementById('order-occasion').value.trim(),
                    designBrief: document.getElementById('order-notes').value.trim(),
                    inspirationLinks: document.getElementById('order-inspiration').value.trim(),
                    customerEmail: auth.currentUser?.email || ''
                }));
                window.location.href = 'measurements.html';
            } catch (error) {
                showOrderMessage(error.message || 'We could not upload your inspiration photos. Please try again.', true);
            }
        });

        function showToast(message, isError = false) {
            clearTimeout(toastTimeout);
            dashboardToast.textContent = message;
            dashboardToast.className = isError
                ? 'fixed right-5 top-5 z-50 max-w-xs border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-800 shadow-lg'
                : 'fixed right-5 top-5 z-50 max-w-xs border border-green-200 bg-green-50 px-4 py-3 text-[11px] text-green-800 shadow-lg';
            toastTimeout = setTimeout(() => {
                dashboardToast.classList.add('hidden');
                dashboardToast.textContent = '';
            }, 10000);
        }

        function showOrderMessage(message, isError = false) {
            orderFormMessage.textContent = message;
            orderFormMessage.className = isError
                ? 'p-3 text-[11px] bg-red-50 border border-red-200 text-red-700'
                : 'p-3 text-[11px] bg-green-50 border border-green-200 text-green-700';
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>'"]/g, (character) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            })[character]);
        }

        function formatEtaValue(value) {
            if (!value) return '';
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return '';
                const parsed = new Date(trimmed);
                if (!Number.isNaN(parsed.getTime())) {
                    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
                }
                return trimmed;
            }
            let date;
            if (typeof value.toDate === 'function') {
                date = value.toDate();
            } else if (value instanceof Date) {
                date = value;
            } else if (typeof value === 'number') {
                date = new Date(value);
            } else if (typeof value === 'object' && value !== null && typeof value.seconds === 'number') {
                date = new Date((value.seconds * 1000) + ((value.nanoseconds || 0) / 1000000));
            }
            if (!date || Number.isNaN(date.getTime())) return '';
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
        }

        async function loadOrders(user) {
            ordersLoading.textContent = 'Loading...';
            try {
                const ordersQuery = query(collection(db, 'orders'), where('userId', '==', user.uid));
                const snapshot = await getDocs(ordersQuery);
                const orders = snapshot.docs.map((orderDocument) => ({ id: orderDocument.id, ...orderDocument.data() }));
                orders.sort((first, second) => (second.createdAt?.toMillis?.() || 0) - (first.createdAt?.toMillis?.() || 0));
                ordersLoading.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
                ordersList.innerHTML = orders.length ? orders.map((order) => {
                    const date = order.createdAt?.toDate?.().toLocaleDateString() || 'Just submitted';
                    const etaValue = formatEtaValue(order.estimatedCompletionAt ?? order.estimatedCompletion ?? order.estimatedCompletionDate ?? order.estimatedTime ?? order.eta ?? null);
                    return `<article class="border border-brand-border bg-white p-5">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p class="text-[10px] uppercase tracking-[0.18em] text-brand-muted">${escapeHtml(order.orderNumber || 'Legacy order')}</p>
                                <p class="text-[10px] uppercase tracking-[0.18em] text-brand-muted">${escapeHtml(order.garment)}</p>
                                <h3 class="mt-1 font-serif text-2xl text-brand-text">${escapeHtml(order.occasion)}</h3>
                            </div>
                            <span class="border border-brand-border px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-brand-text">${escapeHtml(order.status)}</span>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-4 border-t border-brand-border pt-3 text-[11px] text-brand-muted">
                            <p>Submitted<br><span class="text-brand-text">${escapeHtml(date)}</span></p>
                            <p>Estimated completion<br><span class="text-brand-text">${etaValue ? escapeHtml(etaValue) : 'ETA pending'}</span></p>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-4 border-t border-brand-border pt-3 text-[11px] text-brand-muted">
                            <p>Delivery<br><span class="text-brand-text">${escapeHtml(order.deliveryStatus)}</span></p>
                        </div>
                        ${order.adminMessage ? `<div class="mt-4 border-l-2 border-brand-text bg-brand-bg px-3 py-2 text-[11px] leading-5 text-brand-text"><span class="font-medium uppercase tracking-[0.12em]">Atelier update</span><br>${escapeHtml(order.adminMessage)}</div>` : ''}
                        ${['Cancelled', 'Delivered'].includes(order.status) ? '' : `<button type="button" data-cancel-order="${escapeHtml(order.id)}" class="mt-4 border border-red-300 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-red-700 transition-colors hover:bg-red-700 hover:text-white">Cancel Order</button>`}
                    </article>`;
                }).join('') : '<p class="border border-dashed border-brand-border p-5 text-xs text-brand-muted">No orders yet. Submit your first bespoke request.</p>';
            } catch (error) {
                ordersLoading.textContent = '';
                ordersList.innerHTML = '<p class="border border-red-200 bg-red-50 p-5 text-xs text-red-700">We could not load your orders right now.</p>';
                console.error('Unable to load orders:', error);
            }
        }

        ordersList.addEventListener('click', async (event) => {
            const cancelButton = event.target.closest('[data-cancel-order]');
            if (!cancelButton) return;
            if (!window.confirm('Cancel this order request?')) return;

            const user = auth.currentUser;
            if (!user) return;
            cancelButton.disabled = true;
            cancelButton.textContent = 'Cancelling...';
            try {
                await updateDoc(doc(db, 'orders', cancelButton.dataset.cancelOrder), {
                    status: 'Cancelled',
                    deliveryStatus: 'Cancelled',
                    cancelledAt: serverTimestamp()
                });
                showToast('Order cancelled successfully.');
                await loadOrders(user);
            } catch (error) {
                cancelButton.disabled = false;
                cancelButton.textContent = 'Cancel Order';
                showToast('We could not cancel this order.', true);
                console.error('Unable to cancel order:', error);
            }
        });

        orderForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const user = auth.currentUser;
            if (!user) return;
            const submitButton = document.getElementById('dashboard-submit-btn');
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
            try {
                const orderNumber = `RS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
                await setDoc(doc(db, 'orders', orderNumber), {
                    orderNumber,
                    userId: user.uid,
                    customerName: customerName.value.trim(),
                    customerPhone: customerPhone.value.trim(),
                    gender: customerGender.value,
                    customerEmail: user.email,
                    garment: garment.value,
                    occasion: document.getElementById('order-occasion').value.trim(),
                    designBrief: document.getElementById('order-notes').value.trim(),
                    measurements: {},
                    inspirationLinks: document.getElementById('order-inspiration').value.trim().split('\n').filter(Boolean),
                    status: 'Received',
                    deliveryStatus: 'To be confirmed',
                    estimatedCompletionAt: null,
                    createdAt: serverTimestamp()
                });
                orderForm.reset();
                updateGarmentOptions();
                updateMeasurementFlow();
                stepTwoFields.forEach((field) => { field.disabled = true; });
                stepTwo.classList.add('hidden');
                stepOne.classList.remove('hidden');
                showOrderMessage('Your order request has been received.');
                showToast('Order request submitted successfully.');
                await loadOrders(user);
            } catch (error) {
                showOrderMessage('We could not submit your order. Please try again.', true);
                showToast('We could not submit your order.', true);
                console.error('Unable to submit order:', error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Place Order Request';
            }
        });

        document.querySelectorAll('.signout-btn').forEach((button) => button.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'index.html';
        }));

        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');
        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = !mobileMenu.classList.toggle('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
        });
        mobileMenuLinks.forEach((link) => link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
        }));

        onAuthStateChanged(auth, (user) => {
            stopInactivityLogout?.();
            if (!user || user.isAnonymous) {
                window.location.href = 'index.html';
                return;
            }
            stopInactivityLogout = startInactivityLogout(auth, signOut, () => {
                window.location.href = 'index.html';
            });
            const name = user.displayName || user.email?.split('@')[0] || 'Client';
            customerName.value = user.displayName || '';
            document.getElementById('user-display-name').textContent = `Welcome back, ${name}`;
            document.getElementById('user-display-email').textContent = user.email || '';
            loadOrders(user);
        });