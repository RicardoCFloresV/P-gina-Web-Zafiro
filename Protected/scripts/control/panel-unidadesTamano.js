/**
 * panel-unidadesTamano.js
 * Módulo para gestionar la recolección de datos de los formularios de unidades de tamaño.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del DOM
    const btnAccionModal = document.getElementById("btnAccionModal");
    const modalTitle = document.getElementById("modalTitle");
    const modal = document.getElementById("modalUnidadTamano");
  
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
        const valSimbolo = document.getElementById("modalSimbolo").value;
        const valNombre = document.getElementById("modalNombre").value;
  
        // 3. Imprimir los resultados en la consola (Formato solicitado)
        console.log(`Form used name "${formActionName}"`);
        console.log(`element data Símbolo: "${valSimbolo}"`);
        console.log(`element data Nombre: "${valNombre}"`);
        
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