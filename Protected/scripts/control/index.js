document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Manejo del Sidebar en dispositivos móviles
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });

  // Cerrar el sidebar al hacer clic fuera de él en móviles
  document.addEventListener('click', (event) => {
    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnMenuToggle = menuToggle.contains(event.target);
    const isMobileView = window.innerWidth <= 992;

    if (isMobileView && !isClickInsideSidebar && !isClickOnMenuToggle && sidebar.classList.contains('active')) {
      sidebar.classList.remove('active');
    }
  });

  // 2. Manejo del botón de Cerrar Sesión
  const logoutBtn = document.getElementById('logout-btn');
  
  logoutBtn.addEventListener('click', () => {
    // Aquí podrías limpiar el localStorage/sessionStorage o cookies si lo necesitas después.
    // Por ahora, como pediste, redirige al index.html
    
    // Opcional: una pequeña confirmación
    if(confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      window.location.href = 'index.html';
    }
  });

});