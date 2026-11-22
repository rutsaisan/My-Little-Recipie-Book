/**
 * Catálogo de ilustraciones (animalitos y objetos de cocina).
 *
 * Las imágenes se generan sin fondo con `tools/remove_backgrounds.py` a partir
 * de las ilustraciones de referencia. Aquí solo se registran con un nombre
 * estable, su tamaño real y un texto alternativo para la accesibilidad.
 */
import gatoCalicoChef from './gato-calico-chef.webp';
import gatoSiamesBizcocho from './gato-siames-bizcocho.webp';
import gorroChef from './gorro-chef.webp';
import nutriaCroissant from './nutria-croissant.webp';
import patitoNaranja from './patito-naranja.webp';
import perritoHotdog from './perrito-hotdog.webp';
import ratonChef from './raton-chef.webp';
import ratonPizza from './raton-pizza.webp';
import rayaCafetera from './raya-cafetera.webp';
import rayaChocolateFrutos from './raya-chocolate-frutos.webp';
import rayaCorazon from './raya-corazon.webp';
import rayaMantequilla from './raya-mantequilla.webp';
import rayaMiniChocolate from './raya-mini-chocolate.webp';
import rayaMiniMantequilla from './raya-mini-mantequilla.webp';
import rayaNataFresa from './raya-nata-fresa.webp';
import rayaPilaTortitas from './raya-pila-tortitas.webp';
import rayaPlancha from './raya-plancha.webp';
import rayaPlatano from './raya-platano.webp';
import rayaSarten from './raya-sarten.webp';
import rayaTortita from './raya-tortita.webp';
import serpienteCanela from './serpiente-canela.webp';
import tortugaSmore from './tortuga-smore.webp';
import vapor from './vapor.webp';

export interface CharacterArt {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const CHARACTERS = {
  'gato-calico-chef': { src: gatoCalicoChef, width: 441, height: 417, alt: 'Gatita calicó con gorro de chef removiendo una olla' },
  'gato-siames-bizcocho': { src: gatoSiamesBizcocho, width: 640, height: 606, alt: 'Gato siamés con gorro de chef junto a un bizcocho' },
  'gorro-chef': { src: gorroChef, width: 558, height: 446, alt: 'Gorro de chef' },
  'nutria-croissant': { src: nutriaCroissant, width: 410, height: 386, alt: 'Nutria jugando con un cruasán' },
  'patito-naranja': { src: patitoNaranja, width: 380, height: 336, alt: 'Patito abrazado a una rodaja de naranja' },
  'perrito-hotdog': { src: perritoHotdog, width: 416, height: 495, alt: 'Perrito salchicha dentro de un pan de perrito caliente' },
  'raton-chef': { src: ratonChef, width: 446, height: 536, alt: 'Ratoncito con gorro de chef' },
  'raton-pizza': { src: ratonPizza, width: 621, height: 341, alt: 'Ratoncito tapado con una porción de pizza' },
  'raya-cafetera': { src: rayaCafetera, width: 460, height: 403, alt: 'Cafetera con pequeñas rayas nadando en el café' },
  'raya-chocolate-frutos': { src: rayaChocolateFrutos, width: 311, height: 311, alt: 'Raya de chocolate con nata y frutos rojos' },
  'raya-corazon': { src: rayaCorazon, width: 457, height: 316, alt: 'Raya tortita con un corazón' },
  'raya-mantequilla': { src: rayaMantequilla, width: 426, height: 221, alt: 'Raya tortita con mantequilla' },
  'raya-mini-chocolate': { src: rayaMiniChocolate, width: 149, height: 131, alt: 'Pequeña raya tortita con pepitas de chocolate' },
  'raya-mini-mantequilla': { src: rayaMiniMantequilla, width: 135, height: 125, alt: 'Pequeña raya tortita con mantequilla' },
  'raya-nata-fresa': { src: rayaNataFresa, width: 439, height: 205, alt: 'Raya tortita con nata y fresa' },
  'raya-pila-tortitas': { src: rayaPilaTortitas, width: 403, height: 306, alt: 'Pila de rayas tortita en un plato' },
  'raya-plancha': { src: rayaPlancha, width: 469, height: 219, alt: 'Raya tortita haciéndose en la plancha' },
  'raya-platano': { src: rayaPlatano, width: 369, height: 283, alt: 'Raya tortita con plátano' },
  'raya-sarten': { src: rayaSarten, width: 329, height: 368, alt: 'Raya tortita saltando de la sartén' },
  'raya-tortita': { src: rayaTortita, width: 391, height: 206, alt: 'Raya tortita con mantequilla y sirope' },
  'serpiente-canela': { src: serpienteCanela, width: 640, height: 551, alt: 'Serpiente enroscada como un rollo de canela glaseado' },
  'tortuga-smore': { src: tortugaSmore, width: 479, height: 300, alt: "Tortuga con caparazón de galleta, chocolate y nube (s'more)" },
  vapor: { src: vapor, width: 102, height: 113, alt: 'Vapor' },
} satisfies Record<string, CharacterArt>;

export type CharacterId = keyof typeof CHARACTERS;

export function getCharacter(id: CharacterId): CharacterArt {
  return CHARACTERS[id];
}
