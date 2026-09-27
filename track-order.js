import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, getDoc, getDocs, query, where, collection, updateDoc, doc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
        const app = initializeApp({ apiKey: "AIzaSyCzcxTLAUH83sQsia4dPg5py19YzRsmw0o", authDomain: "remagstyle-43b41.firebaseapp.com", projectId: "remagstyle-43b41", messagingSenderId: "145831201308", appId: "1:145831201308:web:489a014516356f73a72dd9" });
        const auth = getAuth(app);
        const db = getFirestore(app); const form = document.getElementById('track-form'); const input = document.getElementById('order-number'); const result = document.getElementById('track-result');
        let liveOrderUnsubscribe = null;
        function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
        function formatEstimatedCompletion(value) {
            if (!value) return 'Estimate pending';
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return 'Estimate pending';
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

            if (!date || Number.isNaN(date.getTime())) return 'Estimate pending';
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
        }
        function stopLiveOrderListener() {
            if (liveOrderUnsubscribe) {
                liveOrderUnsubscribe();
                liveOrderUnsubscribe = null;
            }
        }
        async function getOrderByNumber(orderNumber) {
            const direct = await getDoc(doc(db, 'orders', orderNumber));
            if (direct.exists()) return { id: direct.id, ...direct.data() };

            const snapshot = await getDocs(query(collection(db, 'orders'), where('orderNumber', '==', orderNumber)));
            if (snapshot.empty) return null;
            const match = snapshot.docs[0];
            return { id: match.id, ...match.data() };
        }

        function renderOrderDetails(order) {
            const date = order.createdAt?.toDate?.().toLocaleDateString() || 'Just submitted';
            const estimatedCompletionValue = order.estimatedCompletionAt ?? order.estimatedCompletionDate ?? order.estimatedCompletion ?? order.estimatedTime ?? order.eta ?? null;
            const estimatedCompletion = formatEstimatedCompletion(estimatedCompletionValue);
            result.innerHTML = `<article class="border border-brand-border bg-white p-6"><div class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-[10px] uppercase tracking-[0.2em] text-brand-muted">${escapeHtml(order.orderNumber)}</p><h2 class="mt-2 font-serif text-3xl">${escapeHtml(order.garment)}</h2><p class="mt-1 text-xs text-brand-muted">${escapeHtml(order.occasion)}</p></div><span class="border border-brand-border px-3 py-2 text-[10px] uppercase tracking-[0.15em]">${escapeHtml(order.status)}</span></div><div class="mt-6 grid grid-cols-2 gap-4 border-t border-brand-border pt-4 text-xs text-brand-muted"><p>Submitted<br><span class="text-brand-text">${escapeHtml(date)}</span></p><p>Estimated completion<br><span class="text-brand-text">${escapeHtml(estimatedCompletion)}</span></p></div>${order.adminMessage ? `<div class="mt-5 border-l-2 border-brand-text bg-brand-bg px-3 py-2 text-[11px] leading-5 text-brand-text"><span class="font-medium uppercase tracking-[0.12em]">Atelier update</span><br>${escapeHtml(order.adminMessage)}</div><form id="guest-reply-form" class="mt-4 flex flex-col gap-2 sm:flex-row"><input name="clientReply" required maxlength="1000" placeholder="Reply to the atelier" class="min-w-0 flex-1 border border-brand-border bg-brand-bg px-3 py-2.5 text-[11px] focus:border-brand-text focus:outline-none"><button type="submit" class="bg-brand-text px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white hover:bg-black/80">Send reply</button></form>` : ''}${order.clientReply ? `<div class="mt-3 border-l-2 border-brand-border px-3 py-2 text-[11px] leading-5 text-brand-muted"><span class="font-medium uppercase tracking-[0.12em] text-brand-text">Your reply</span><br>${escapeHtml(order.clientReply)}</div>` : ''}</article>`;
            const replyForm = document.getElementById('guest-reply-form');
            replyForm?.addEventListener('submit', async (event) => {
                event.preventDefault();
                const button = replyForm.querySelector('button');
                const reply = new FormData(replyForm).get('clientReply')?.toString().trim();
                if (!reply) return;
                button.disabled = true;
                button.textContent = 'Sending...';
                try {
                    await updateDoc(doc(db, 'orders', order.id), { clientReply: reply, clientReplyAt: serverTimestamp() });
                    order.clientReply = reply;
                    replyForm.outerHTML = `<div class="mt-3 border-l-2 border-brand-border px-3 py-2 text-[11px] leading-5 text-brand-muted"><span class="font-medium uppercase tracking-[0.12em] text-brand-text">Your reply</span><br>${escapeHtml(reply)}</div>`;
                } catch (error) {
                    button.disabled = false;
                    button.textContent = 'Send reply';
                    console.error('Unable to send guest reply:', error);
                }
            });
        }

        async function trackOrder(orderNumber) {
            stopLiveOrderListener();
            result.innerHTML = '<p class="text-center text-xs text-brand-muted">Looking up your order...</p>';
            try {
                const order = await getOrderByNumber(orderNumber);
                if (!order) { result.innerHTML = '<p class="border border-red-200 bg-red-50 p-4 text-xs text-red-700">No order was found with that number. Check it and try again.</p>'; return; }
                renderOrderDetails(order);
                liveOrderUnsubscribe = onSnapshot(doc(db, 'orders', order.id), (snapshot) => {
                    if (!snapshot.exists()) return;
                    const liveOrder = { id: snapshot.id, ...snapshot.data() };
                    renderOrderDetails(liveOrder);
                }, (error) => {
                    console.error('Unable to listen for live order updates:', error);
                });
            } catch (error) { result.innerHTML = '<p class="border border-red-200 bg-red-50 p-4 text-xs text-red-700">We could not look up your order right now.</p>'; console.error('Unable to track order:', error); }
        }
        form.addEventListener('submit', (event) => { event.preventDefault(); trackOrder(input.value.trim().toUpperCase()); });
        const initialOrder = new URLSearchParams(window.location.search).get('order'); if (initialOrder) { input.value = initialOrder; trackOrder(initialOrder.toUpperCase()); }