importScripts('lodash.js');

let canvas = null;
let ctx_worker = null;
let my_image_data = null;
let size_x = null;
let size_y = null;
let T_star = null;
let steps = 0
let max_steps = 500

function sfc32(a, b, c, d) {
    return function () {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        let x = (t >>> 0) / 4294967296;
        //console.log('rand', x)
        return x;
    }
}

let rand = null;

/*
   Acts as a dictionary where the keys are the integer coordinates
   (x,y)
*/
class CoordsDict {
    constructor() {
        this.data = new Map();
    }

    hash(x, y) {
        return  (x << 20) | y;
    }

    get(x, y) {
        let v = this.data.get(this.hash(x, y));
        if (v) {
            return v[2];
        }
    }

    set(x, y, v) {
        return this.data.set(this.hash(x, y), [x, y, v]);
    }

    delete(x, y) {
        return this.data.delete(this.hash(x, y));
    }

    is(x, y) {
        return this.data.has(this.hash(x, y));
    }

    keys() {
        return Array.from(this.data.values(), (v) => ({x: v[0], y: v[1]}));
    }

    keys2() {
        return this.data.values()
    }

    size() {
        return this.data.size;
    }
}

const ON = 1;
const OFF = 0;

const DENSITY_LEVELS = ['high', 'medium', 'low']

var build_probability = null;
var isolated_centrality_probability = null
var block_pop = null
var max_ab_km2 = null
var population_density = null
var prob_distribution = null

let centralities = null;
let inhabitants = null;
let nature_dict = null;
let houses = null;
let neighbours = null;

let central_points_candidates_1 = null
let central_points_candidates_2 = null
let central_points_candidates = null

function add_neighbours(x, y) {
    neighbours.delete(x, y);
    for (const [i, j] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
    ]) {
        if (0 <= i && i < size_x && 0 <= j && j < size_y) {
            neighbours.set(i, j, ON);
        }
    }
}

function set_centralities(amenities) {
    for (const centrality of amenities) {
        const x = centrality.x;
        const y = centrality.y;
        nature_dict.delete(x, y);
        central_points_candidates.delete(x, y);
        centralities.set(x, y, ON);
        add_neighbours(x, y);
    }
}

function is_in_interior(x, y) {
    return (
        T_star <= x && x < size_x - T_star && T_star <= y && y < size_y - T_star
    );
}

function d2(x1, y1, x2, y2) {
    return Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
}

/*
This function could be further optimised with some k-nearest neighbours
data-structure such as kd-tree.
 */
function is_centrality_near(x, y) {
    if (centralities.size() < 4 * T_star * T_star) {
        for (const [i, j, _] of centralities.keys2()) {
            if (d2(x, y, i, j) <= Math.pow(T_star, 2)) {
                return true;
            }
        }
    } else {
        for (const i of _.range(x - T_star, x + T_star + 1)) {
            for (const j of _.range(y - T_star, y + T_star + 1)) {
                if (centralities.is(i, j) && d2(x, y, i, j) <= Math.pow(T_star, 2)) {
                    return true;
                }
            }
        }
    }

    return false;
}

function nature_stays_reachable(x, y) {
    for (const i of _.range(x - T_star, x + T_star + 1)) {
        for (const j of _.range(y - T_star, y + T_star + 1)) {
            if (i !== x && j !== y
                && nature_dict.is(x, y)
                && d2(x, y, i, j) <= T_star * T_star) {
                return true
            }
        }
    }
    return false
}

function nature_stays_wide(x, y) {
    // along the horizontal axis, we traverse form the x coordinate of the test point right util we reach no nature no further than margin
    let i = 1
    while (nature_dict.is(x + i, y) && i <= T_star && x + i < size_x) {
        i += 1
    }
    if (T_star > i && i > 1) {
        return 'no'
    }

    // along the horizontal axis, we traverse form the x coordinate of the test point left util we reach no nature no further than margin
    i = 1
    while (nature_dict.is(x - i, y) && i <= T_star && x - i >= 0) {
        i += 1
    }
    if (T_star > i && i > 1) {
        return 'no'
    }

    // along the vertical axis, we traverse form the y coordinate of the test point down util we reach no nature no further than margin
    i = 1
    while (nature_dict.is(x, y + i) && i <= T_star && y + i < size_y) {
        i += 1
    }
    if (T_star > i && i > 1) {
        return 'no'
    }

    // along the vertical axis, we traverse form the y coordinate of the test point down util we reach no nature no further than margin
    i = 1
    while (nature_dict.is(x, y - i) && i <= T_star && y - i >= 0) {
        i += 1
    }
    if (T_star > i && i > 1) {
        return 'no'
    }
    return 'yes'
}

function nature_stays_extended(x, y) {
    return nature_stays_wide(x, y)
}

function can_build(x, y) {
    if (nature_dict.is(x, y)) {
        if (!nature_stays_reachable(x, y)) {
            return 'ex'
        } else {
            return nature_stays_extended(x, y)
        }
    } else {
        return 'ex'
    }
}

function can_build_house(x, y) {
    if (
        nature_dict.is(x, y) &&
        is_in_interior(x, y) &&
        is_centrality_near(x, y)
    ) {
        return can_build(x, y)
    } else {
        return "no";
    }
}

function initSimulation() {
    rand = sfc32(1, 1, 1, 1);
    centralities = new CoordsDict();
    inhabitants = new CoordsDict();
    nature_dict = new CoordsDict();
    neighbours = new CoordsDict();
    houses = new CoordsDict();

    central_points_candidates_1 = []
    central_points_candidates_2 = []
    central_points_candidates = new CoordsDict();

    // we keep the green belt free from central points candidates
    for (const x of _.range(T_star, size_x - T_star)) {
        for (const y of _.range(T_star, size_y - T_star)) {
            central_points_candidates_1.push({x: x, y: y})
            central_points_candidates.set(x, y, ON)
        }
    }
    central_points_candidates_1 = _.shuffle(central_points_candidates_1)

    for (const x of _.range(size_x)) {
        for (const y of _.range(size_y)) {
            nature_dict.set(x, y, ON);
        }
    }


    set_centralities([{x: Math.floor(size_x / 2), y: Math.floor(size_y / 2)}]);

    ctx_worker.fillStyle = "#00672e";
    ctx_worker.clearRect(0, 0, size_x, size_y);

    ctx_worker.fillRect(0, 0, size_x, size_y);
    my_image_data = ctx_worker.getImageData(0, 0, canvas.width, canvas.height);

    for (const [x, y, _] of centralities.keys2()) {
        setPoint(x, y, "red");
    }

    steps = 0
}

/*
    The error function (erf) is a special function that is defined as:
    erf(x) = (2/sqrt(pi)) * integral_{0}^{x} e^(-t^2) dt

    the inverse of erf(x) is defined as:
    erf^-1(x) = mu + sigma * sqrt(2) * erf^(-1)(2*p - 1)

    Below is the code implementing the approximate erf^-1(x)

    https://people.maths.ox.ac.uk/gilesm/files/gems_erfinv.pdf
    http://www.mimirgames.com/articles/programming/approximations-of-the-inverse-error-function/
 */
function m_giles_inv_error(x) {
    let p;
    let w = -Math.log((1.0 - x) * (1.0 + x))

    if (w < 0.5) {
        w = w - 2.5;
        p = 2.81022636e-08;
        p = 3.43273939e-07 + p * w;
        p = -3.5233877e-06 + p * w;
        p = -4.39150654e-06 + p * w;
        p = 0.00021858087 + p * w;
        p = -0.00125372503 + p * w;
        p = -0.00417768164 + p * w;
        p = 0.246640727 + p * w;
        p = 1.50140941 + p * w;
    } else {
        w = Math.sqrt(w) - 3.0;
        p = -0.000200214257;
        p = 0.000100950558 + p * w;
        p = 0.00134934322 + p * w;
        p = -0.00367342844 + p * w;
        p = 0.00573950773 + p * w;
        p = -0.0076224613 + p * w;
        p = 0.00943887047 + p * w;
        p = 1.00167406 + p * w;
        p = 2.83297682 + p * w;
    }
    return p * x;
}

/* Equivalent of Numpy np.random.binomial

   There is no analytical formula for the inverse of the binomial
   cumulative distribution function (CDF) that is accurate for all values of n and p.
   However, for large values of n and small values of p, the binomial distribution
   can be approximated by the normal distribution. In this case,
   the inverse normal CDF (also known as the quantile function or the probit function)
   can be used to approximate the inverse binomial CDF.

   The inverse normal CDF is given by the formula:

 */
function binomial(n, p) {
    const x = rand() //Math.random()
    const mu = n * p
    const sigma = Math.sqrt(n * p * (1 - p))
    return Math.ceil(mu + sigma * Math.sqrt(2) * m_giles_inv_error(2 * x - 1))
}

function set_block_population(block_population, density_level, population_density) {
    return {
        inhabitants: block_population * population_density[density_level],
        density_level: density_level
    }
}

function place_central_points() {
    let central_points_count = binomial(size_x * size_y, isolated_centrality_probability / (size_x * size_y))
    let points_placed = 0
    while ((central_points_candidates_1.length > 0 || central_points_candidates_2.length > 0)
    && points_placed < central_points_count) {
        if (central_points_candidates_1.length === 0) {
            central_points_candidates_1 = _.shuffle(central_points_candidates_2)
            central_points_candidates_2 = []
        }
        let {x: x, y: y} = central_points_candidates_1.pop()

        if (central_points_candidates.is(x, y) && nature_dict.is(x, y)) {
            if (can_build(x, y) === 'yes') {
                //console.log('central', x, y)
                central_points_candidates.delete(x, y);
                points_placed += 1
                centralities.set(x, y, ON)
                houses.delete(x, y)
                setPoint(x, y, "red");
                add_neighbours(x, y)
                nature_dict.delete(x, y)
                inhabitants.set(x, y, set_block_population(block_pop, 'empty', population_density))
            } else if (can_build(x, y) === 'ex') {
                neighbours.delete(x, y)
                nature_dict.delete(x, y)
                central_points_candidates.delete(x, y);
            } else if (can_build(x, y) === 'no') {
                central_points_candidates_2.push({x: x, y: y})
            }
        }
    }
    return points_placed
}

function random_choice(arr, probs) {
    let r = rand() //Math.random();
    let cum_probs = []
    probs.map((p, i) => [p, arr[i]]).reduce((acc, b) => {
        cum_probs.push([acc + b[0], b[1]]);
        return acc + b[0]
    }, 0);
    return cum_probs.find((p) => r < p[0])[1];
}

function simulationStep() {
    // add new central points
    let added_centrality = place_central_points()
    //console.log('added_centrality', added_centrality)

    // build houses in the neighbourhoods of the existing buildings
    let build_houses = []
    for (const [x, y, _] of neighbours.keys2()) {
        //console.log('house', x, y)
        if (rand() < build_probability) { // Math.random()
            if (can_build_house(x, y) === "yes") {
                let density_level = random_choice(DENSITY_LEVELS, prob_distribution)
                let population = set_block_population(block_pop, density_level, population_density)
                inhabitants.set(x, y, population)
                if (population['density_level'] === 'high') {
                    setPoint(x, y, 'black');
                } else if (population['density_level'] === 'medium') {
                    setPoint(x, y, 'grey');
                } else if (population['density_level'] === 'low') {
                    setPoint(x, y, 'light_grey');
                }
                //setPoint(x, y, 'blue');
                nature_dict.delete(x, y)
                houses.set(x, y, ON)
                build_houses.push([x,y])
                central_points_candidates_2.push({x: x, y: y})
            }
        }
    }
    for (const [x, y] of build_houses){
        add_neighbours(x, y);
    }
}

// Waiting to receive the OffScreenCanvas
self.onmessage = function (e) {
    if (typeof e.data == "string") {
        for (let i = 0; i < 2000000000; i++) {
            //;;;
        }
    } else if (e.data.command === "re-run") {
        T_star = e.data.params.T_star
        build_probability = e.data.params.build_probability
        isolated_centrality_probability = e.data.params.isolated_centrality_probability
        max_ab_km2 = e.data.params.max_ab_km2
        block_pop = max_ab_km2 / Math.pow(T_star, 2)
        population_density = e.data.params.population_density
        prob_distribution = e.data.params.prob_distribution

        initSimulation();

        startCounting();
    } else {
        canvas = e.data.canvas
        size_x = canvas.width
        size_y = canvas.height
        T_star = e.data.params.T_star
        build_probability = e.data.params.build_probability
        isolated_centrality_probability = e.data.params.isolated_centrality_probability
        max_ab_km2 = e.data.params.max_ab_km2
        block_pop = max_ab_km2 / Math.pow(T_star, 2)
        population_density = e.data.params.population_density
        prob_distribution = e.data.params.prob_distribution

        //
        ctx_worker = canvas.getContext("2d");

        initSimulation();

        startCounting();
    }
};

const getColorIndicesForCoord = (x, y, width) => {
    const red = y * (width * 4) + x * 4;
    return [red, red + 1, red + 2, red + 3];
};

function setPixel(imageData, width, x, y) {
    const [R, G, B, A] = getColorIndicesForCoord(x, y, width);
    const data = imageData.data;
    data[R] = 255;
    data[G] = 0;
    data[B] = 0;
    data[A] = 255;
}

function setPoint(x, y, color) {
    let rgba;
    switch (color) {
        case "red":
            rgba = [255, 0, 0, 255];
            break;
        case "green":
            rgba = [0, 255, 0, 255];
            break;
        case "blue":
            rgba = [0, 0, 255, 255];
            break;
        case "grey":
            rgba = [85, 85, 85, 255];
            break;
        case "light_grey":
            rgba = [170, 170, 170, 255];
            break;
        case "white":
            rgba = [255, 255, 255, 255];
            break;
        case "black":
            rgba = [0, 0, 0, 255];
            break;
        default:
            rgba = color;
    }
    const [R, G, B, A] = getColorIndicesForCoord(x, y, size_x);
    const data = my_image_data.data;

    data[R] = rgba[0];
    data[G] = rgba[1];
    data[B] = rgba[2];
    data[A] = rgba[3];
}

function startCounting() {
    redrawCanvas()
    let the_timer = setInterval(function () {
        if (steps < max_steps) {
            redrawCanvas()
        } else {
            clearInterval(the_timer)
        }
        steps += 1
    }, 1);
}

// Redraw Canvas
function redrawCanvas() {
    console.log('redrawCanvas')
    simulationStep();
    ctx_worker.putImageData(my_image_data, 0, 0);
}
