// EmailJS Configuration
export const EMAILJS_CONFIG = {
  serviceId: process.env.REACT_APP_EMAILJS_SERVICE_ID,
  templateId: process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
  publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY,
};

// EmailJS initialization
export const initializeEmailJS = () => {
  // Validate that all EmailJS environment variables are present
  if (
    !EMAILJS_CONFIG.serviceId ||
    !EMAILJS_CONFIG.templateId ||
    !EMAILJS_CONFIG.publicKey
  ) {

    return false;
  }
  return true;
};
