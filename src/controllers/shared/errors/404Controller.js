export function init404Controller() {

    const backButton = document.getElementById('backButton');

    if (!backButton) return;

    backButton.addEventListener('click', () => {

        if (
            document.referrer &&
            document.referrer.includes(window.location.host)
        ) {

            window.history.back();

        } else {

            window.navigateTo('/');

        }

    });

} 