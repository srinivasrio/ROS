import { useMemo } from "react";

import pizzaImg from "@/assets/food/pizza.png";
import burgerImg from "@/assets/food/burger.png";
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

const foodImages = [
  pizzaImg, burgerImg, coffeeImg, cupcakeImg, saladImg, icecreamImg,
  croissantImg, sushiImg, donutImg, chickenImg, hotdogImg, appleImg,
];

interface Props {
  count?: number;
  opacity?: number;
}

const FoodFloaters = ({ count = 24, opacity = 0.5 }: Props) => {
  const floaters = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      src: foodImages[i % foodImages.length],
      left: `${Math.random() * 95}%`,
      top: `${Math.random() * 90}%`,
      size: 28 + Math.random() * 28,
      animationDuration: `${8 + Math.random() * 14}s`,
      animationDelay: `${Math.random() * 15}s`,
      rotation: Math.random() * 360,
      opacity,
    }));
  }, [count, opacity]);

  return (
    <>
      {floaters.map((f) => (
        <span
          key={f.id}
          className="food-floater"
          style={{
            left: f.left,
            top: f.top,
            animationDuration: f.animationDuration,
            animationDelay: f.animationDelay,
          }}
        >
          <img
            src={f.src}
            alt=""
            width={f.size}
            height={f.size}
            style={{
              opacity: f.opacity,
              transform: `rotate(${f.rotation}deg)`,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
            }}
            loading="lazy"
            draggable={false}
          />
        </span>
      ))}
    </>
  );
};

export default FoodFloaters;
