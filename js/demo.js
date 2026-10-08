// Datos de demostración para probar Memvia sin crear una cuenta.
// Todo es inventado. Los lugares son sitios públicos de Madrid y los nombres
// no corresponden a personas reales.

export const DEMO_KEY = 'memvia_demo_v1';

export const DEMO_STATE = {
  userName: 'Antonia',
  home: { address: 'Puerta del Sol, Madrid', lat: 40.41692, lng: -3.70351 },
  family: [
    { id: 'd-marta', name: 'Marta', relation: 'Hija', phone: '34000000000', address: 'Plaza Mayor, Madrid', photo: '', birthday: '', note: 'Te llama cada mañana. Trabaja en la farmacia.', primary: true, icon: '👩', lat: 40.41537, lng: -3.7074 },
    { id: 'd-lucia', name: 'Lucía', relation: 'Nieta', phone: '', address: 'Museo del Prado, Madrid', photo: '', birthday: '', note: 'Le encanta que le cuentes cómo era el pueblo.', primary: false, icon: '👧', lat: 40.41378, lng: -3.69214 },
    { id: 'd-javier', name: 'Javier', relation: 'Hijo', phone: '', address: 'Estación de Atocha, Madrid', photo: '', birthday: '', note: 'Viene los domingos con el pan.', primary: false, icon: '👨', lat: 40.40654, lng: -3.69076 },
    { id: 'd-pablo', name: 'Pablo', relation: 'Nieto', phone: '', address: 'Teatro Real, Madrid', photo: '', birthday: '', note: 'Toca la guitarra y le gusta cantarte.', primary: false, icon: '👦', lat: 40.41846, lng: -3.71047 },
    { id: 'd-rosa', name: 'Rosa', relation: 'Hermana', phone: '', address: 'Puerta de Alcalá, Madrid', photo: '', birthday: '', note: 'Crecisteis juntas. Siempre os reís mucho.', primary: false, icon: '👵', lat: 40.41999, lng: -3.68877 }
  ],
  places: [
    { id: 'd-farmacia', name: 'Farmacia', category: 'farmacia', address: 'Calle del Carmen, Madrid', lat: 40.41823, lng: -3.70466 },
    { id: 'd-centro', name: 'Centro de salud', category: 'medico', address: 'Calle de Atocha, Madrid', lat: 40.41258, lng: -3.69972 }
  ],
  reminders: [
    { id: 'd-r1', text: 'Desayunar', time: '09:00', icon: '🍽️', done: false },
    { id: 'd-r2', text: 'Dar un paseo', time: '11:00', icon: '🚶', done: false },
    { id: 'd-r3', text: 'Comer', time: '14:00', icon: '🍽️', done: false },
    { id: 'd-r4', text: 'Llamar a Marta', time: '18:00', icon: '📞', done: false },
    { id: 'd-r5', text: 'Cenar', time: '21:00', icon: '🍽️', done: false }
  ],
  meds: [
    { id: 'd-m1', name: 'Pastilla de la mañana', dose: '1 comprimido', time: '09:30', history: [] },
    { id: 'd-m2', name: 'Pastilla de la noche', dose: '1 comprimido', time: '21:30', history: [] }
  ],
  memories: [
    { id: 'd-mem1', title: 'El viaje a la playa', text: 'Un verano fuimos todos juntos a la playa. Rosa hizo tortilla y Javier se quedó dormido bajo la sombrilla.' }
  ],
  fsScale: 1,
  simpleMode: false,
  theme: 'auto'
};
