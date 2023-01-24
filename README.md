# isobenefit-cities-web
Isobenefit Urbanism on the Web

##Goals of these iterations 
The goal of creating a web version implemented in JavaScript of the visualisation of evolutionary scenarios of the urban morphogenesis model is to make it more accessible to a wider audience. This version does not require the user to have set up a python environment, making it ready to use. I simplified the visualisation while accelerating its generation, making it more efficient to interpret.

Altered from Dr. Luca D’Acci and Dr. Michele Voto’s code [https://lucadacci.wixsite.com/dacci/isobenefit-urbanism-morphogenesis] [https://github.com/mitochevole/isobenefit-cities ], I have improved the performance by changing the strategy from iterating over every cell of the simulated universe on which there are performed computationally expensive operations O(N^2) resulting in O(N^4) overall computational cost, to the strategy where we iterate over the cells which are potential new neighbours of the existing building. The central points which don’t necessarily spawn of existing buildings are generated by drawing the number of new central points from a binomial distribution (which is usually a very small number) only to randomly select their new location (the cost of this new approach is probabilistically O(N). 

Currently, this is only a work in progress, aiming to present the concept for a more interactive version. By successfully speeding up the simulation (which has been deliberately slowed down in the web animation to present how the cells expand), it opens up the possibility of introducing panels for adjusting parameters for the user to interact with. Without this speeding up, this wouldn’t be possible due to the time taken to compute a single iteration.  

The urban morphogenesis model acts as a catalyst for applying change and we would be able to visualise what needs to be done to address these issues such as sustainability and well-being, while considering existing market dynamics and policy restrictions. By making it available faster, and to a wider audience it might potentially open up collaborative ideas from other areas, therefore addressing urban issues with more diversity and consideration. 


See the working example here [https://notch-tangible-sidecar.glitch.me/](https://notch-tangible-sidecar.glitch.me/)
