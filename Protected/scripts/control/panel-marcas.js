/**
 * panel-marcas.js
 * Módulo para gestionar la recolección de datos de los formularios de marcas.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del DOM
    const btnAccionModal = document.getElementById("btnAccionModal");
    const modalTitle = document.getElementById("modalTitle");
    const modal = document.getElementById("modalMarca");
  
    // Verificamos que el botón exista
    if (btnAccionModal) {
      btnAccionModal.addEventListener("click", (e) => {
        e.preventDefault();
  
        // 1. Determinar qué acción se está realizando
        const titleText = modalTitle.innerText.toLowerCase();
        let formActionName = "añadir";
        
        if (titleText.includes("editar") || titleText.includes("modificar")) {
          formActionName = "editar";
        }
  
        // 2. Obtener los datos de los inputs del formulario
        const valNombre = document.getElementById("modalNombre").value;
        const valDescripcion = document.getElementById("modalDescripcion").value;
  
        // 3. Imprimir los resultados en la consola (Formato solicitado)
        console.log(`Form used name "${formActionName}"`);
        console.log(`element data Nombre: "${valNombre}"`);
        console.log(`element data Descripción: "${valDescripcion}"`);
        
        // 4. Mostrar alerta / Toast y cerrar modal
        if (window.showToast) {
            window.showToast('Datos capturados en consola (No hay conexión con el servidor)', true);
        }
        
        if (modal) {
            modal.classList.remove('active');
        }
      });
    }
});