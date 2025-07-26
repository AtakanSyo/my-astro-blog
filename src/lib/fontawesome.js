// src/lib/fontawesome.js
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'; 
// if you’re using React, you’d use: 
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// brands:
import { 
  faFacebookF, 
  faTwitter, 
  faWhatsapp, 
  faInstagram 
} from '@fortawesome/free-brands-svg-icons';

// solid:
import { faLink } from '@fortawesome/free-solid-svg-icons';

// register them all:
library.add(faFacebookF, faTwitter, faWhatsapp, faInstagram, faLink);
export default FontAwesomeIcon;