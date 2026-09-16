// اجرای کدها بعد از بارگذاری کامل صفحه
document.addEventListener('DOMContentLoaded', () => {
    
    // --- مدیریت نقطه‌های اسلایدر (Dots) ---
    const dots = document.querySelectorAll('.dot');
    
    dots.forEach(dot => {
        dot.addEventListener('click', function() {
            // حذف کلاس active از تمام نقطه‌ها
            dots.forEach(d => d.classList.remove('active'));
            
            // اضافه کردن کلاس active به نقطه‌ای که کلیک شده است
            this.classList.add('active');
            
            // دریافت شماره اسلاید برای منطق‌های بعدی
            const slideNumber = this.getAttribute('data-slide');
            console.log(`اسلاید شماره ${slideNumber} فعال شد.`);
        });
    });

    // --- مدیریت دکمه Order Now ---
    const orderBtn = document.querySelector('.order-btn');
    if (orderBtn) {
        orderBtn.addEventListener('click', () => {
            alert('به صفحه سفارشات خوش آمدید!');
        });
    }

    // --- مدیریت دکمه Explore Products ---
    const exploreBtn = document.querySelector('.explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            alert('در حال انتقال به صفحه محصولات...');
        });
    }
});
