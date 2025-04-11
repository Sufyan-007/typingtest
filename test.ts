interface StandardLonghandProperties<TTime = string & {}> {
    animationDelay?: Property.AnimationDelay<TTime> | undefined;
    animationDirection?: Property.AnimationDirection | undefined;
  
}

namespace Property{
    export interface AnimationDelay<X>{
        x:X
    }
    export interface AnimationDirection{
        
    }
}

