// اجرای کدها بعد از بارگذاری کامل صفحه
document.addEventListener('DOMContentLoaded', () => {
    const dots = document.querySelectorAll('.dot');

    dots.forEach(dot => {
        dot.addEventListener('click', function() {
            dots.forEach(d => d.classList.remove('active'));
            this.classList.add('active');
            const slideNumber = this.getAttribute('data-slide');
            console.log(`اسلاید شماره ${slideNumber} فعال شد.`);
        });
    });

    const orderBtn = document.querySelector('.order-btn');
    if (orderBtn) {
        orderBtn.addEventListener('click', () => {
            alert('به صفحه سفارشات خوش آمدید!');
        });
    }

    const exploreBtn = document.querySelector('.explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            alert('در حال انتقال به صفحه محصولات...');
        });
    }
});
