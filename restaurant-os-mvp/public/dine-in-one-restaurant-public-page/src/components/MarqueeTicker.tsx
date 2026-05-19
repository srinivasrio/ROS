import pizzaImg from "@/assets/food/pizza.png";

import coffeeImg from "@/assets/food/coffee.png";
import cupcakeImg from "@/assets/food/cupcake.png";
import saladImg from "@/assets/food/salad.png";
import icecreamImg from "@/assets/food/icecream.png";
import croissantImg from "@/assets/food/croissant.png";
import sushiImg from "@/assets/food/sushi.png";
import donutImg from "@/assets/food/donut.png";
import chickenImg from "@/assets/food/chicken.png";
import hotdogImg from "@/assets/food/hotdog.png";
import appleImg from "@/assets/food/apple.png";

const foodIcons = [
  pizzaImg, coffeeImg, cupcakeImg, saladImg, icecreamImg,
  croissantImg, sushiImg, donutImg, chickenImg, hotdogImg, appleImg,
];

const MarqueeTicker = () => (
  <div className="w-full py-3 overflow-hidden">
    <div className="marquee-track">
      {[0, 1].map((set) => (
        <div key={set} className="flex items-center gap-8 px-4">
          {[...foodIcons, ...foodIcons, ...foodIcons].map((src, i) => (
            <img
              key={`${set}-${i}`}
              src={src}
              alt=""
              className="w-8 h-8 object-contain drop-shadow-md"
              draggable={false}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default MarqueeTicker;
