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

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const paymentWorkerUrl = 'https://remagstyle-paystack-worker.1realstranger.workers.dev';
        const PAID_WORDS = ['paid', 'success', 'successful', 'confirmed'];
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

        function isPaidOrder(order) {
            return PAID_WORDS.includes(String(order.paymentStatus || '').toLowerCase());
        }

        function formatMoney(value, currency) {
            try { return new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(value); }
            catch { return `${Number(value).toFixed(2)} ${currency}`; }
        }

        // The amount shown is the order's paymentAmount, the same field the payment server charges.
        function renderPaymentBlock(order) {
            const amount = Number(order.paymentAmount);
            const currency = String(order.currency || 'GHS').trim().toUpperCase();
            const hasAmount = Number.isFinite(amount) && amount > 0 && /^[A-Z]{3}$/.test(currency);
            const paid = isPaidOrder(order);
            const cancelled = ['cancelled', 'canceled'].includes(String(order.status || '').toLowerCase());
            if (!hasAmount) {
                return `<div class="mt-4 border-t border-brand-border pt-3 text-[11px] text-brand-muted"><p>Amount due<br><span class="text-brand-text">Pending. The atelier will confirm your price.</span></p></div>`;
            }
            const paidDate = order.paidAt ? new Date(order.paidAt) : null;
            const paidLine = paid && Number.isFinite(Number(order.paidAmount))
                ? `Received ${formatMoney(Number(order.paidAmount), String(order.paidCurrency || currency).toUpperCase())}${paidDate && !Number.isNaN(paidDate.getTime()) ? ` on ${paidDate.toLocaleDateString()}` : ''}`
                : '';
            const badge = paid ? 'Paid' : cancelled ? 'Cancelled' : 'Awaiting payment';
            const canPay = !paid && !cancelled;
            return `<div class="mt-4 border-t border-brand-border pt-3">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p class="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Amount due</p>
                                <p class="mt-1 font-serif text-2xl text-brand-text">${escapeHtml(formatMoney(amount, currency))}</p>
                                ${paidLine ? `<p class="mt-1 text-[11px] text-brand-muted">${escapeHtml(paidLine)}</p>` : ''}
                            </div>
                            <span class="border border-brand-border px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-brand-muted">${badge}</span>
                        </div>
                        ${canPay ? `<button type="button" data-pay-order="${escapeHtml(order.id)}" class="mt-3 w-full bg-brand-text px-5 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white hover:bg-black/80">Pay Now</button><p data-pay-error class="mt-3 hidden border border-red-200 bg-red-50 p-3 text-[11px] text-red-700" role="status"></p>` : ''}
                    </div>`;
        }

        async function startPayment(button) {
            const user = auth.currentUser;
            const errorBox = button.closest('article')?.querySelector('[data-pay-error]');
            const fail = (message) => { if (errorBox) { errorBox.textContent = message; errorBox.classList.remove('hidden'); } };
            errorBox?.classList.add('hidden');
            if (!user) { fail('Please log in again to pay.'); return; }
            button.disabled = true;
            button.textContent = 'Opening Paystack...';
            try {
                // Only the order id is sent. The amount is decided by the server from Firestore.
                const token = await user.getIdToken();
                const response = await fetch(`${paymentWorkerUrl}/initialize-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ orderId: button.dataset.payOrder })
                });
                const checkout = await response.json().catch(() => ({}));
                if (!response.ok || !checkout.ok || !checkout.authorizationUrl) {
                    throw new Error(checkout.error || 'We could not start payment. Please try again.');
                }
                const destination = new URL(checkout.authorizationUrl);
                if (destination.protocol !== 'https:' || !destination.hostname.endsWith('paystack.com')) {
                    throw new Error('We could not start payment. Please try again.');
                }
                window.location.assign(destination.toString());
            } catch (error) {
                button.disabled = false;
                button.textContent = 'Pay Now';
                fail(error.message || 'We could not start payment. Please try again.');
                console.error('Unable to start Paystack checkout:', error);
            }
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
                        ${renderPaymentBlock(order)}
                        ${['Cancelled', 'Delivered'].includes(order.status) || isPaidOrder(order) ? '' : `<button type="button" data-cancel-order="${escapeHtml(order.id)}" class="mt-4 border border-red-300 px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-red-700 transition-colors hover:bg-red-700 hover:text-white">Cancel Order</button>`}
                    </article>`;
                }).join('') : '<p class="border border-dashed border-brand-border p-5 text-xs text-brand-muted">No orders yet. Submit your first bespoke request.</p>';
            } catch (error) {
                ordersLoading.textContent = '';
                ordersList.innerHTML = '<p class="border border-red-200 bg-red-50 p-5 text-xs text-red-700">We could not load your orders right now.</p>';
                console.error('Unable to load orders:', error);
            }
        }

        ordersList.addEventListener('click', async (event) => {
            const payButton = event.target.closest('[data-pay-order]');
            if (payButton) { await startPayment(payButton); return; }
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

        window.addEventListener('pageshow', (event) => {
            if (event.persisted && auth.currentUser) loadOrders(auth.currentUser);
        });

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