const fetch = require('node-fetch');

class APIHandler {
    constructor(client) {
        this.client = client;

        // Endpoint base
        this.base = `https://api.themoviedb.org/3/`;
    }

    // Error
    error(message) {
        return { 'error': message };
    }

    // Check type of ID. IMDb, TMDb, or none
    ID(query) {
        const type = query.match(/^(nm|tt|t)(\d+)/);

        if (!type) return false;
        if (type[1] === 'nm' || type[1] === 'tt') return 'imdb';
        return 'tmdb';
    }

    // Get from the API
    async get(endpoint, query) {
        let valid;

        query = query ? query : '';
        let apiKey = `api_key=${this.client.config.tokens.api.tmdb}&language=en-US`;
        apiKey = query ? `&${apiKey}` : `?${apiKey}`;

        try {
            let response = await fetch(`${this.base}${endpoint}${query}${apiKey}`);

            const headers = response.headers;
            const remaining = headers.get('X-RateLimit-Remaining');
            if (remaining < 4) {
                this.client.handlers.log.info('Ratelimited.');

                return this.error('Ratelimited. Try again in a few seconds.');
            }

            response = await response.json();
            if (response && typeof response.success === 'undefined')
                valid = response;
        } catch (err) {
            console.log(err);
        }

        if (!valid) return this.error('Unable to get data from API.');
        return valid;
    }

    // Get a movie ID
    async getMovieID(query) {
        const ID = this.ID(query);

        if (ID === 'tmdb') return query.slice(1);

        if (ID === 'imdb') {
            const movies = await this.get(`find/${query}`,
                '?external_source=imdb_id');
            if (movies.error) return movies;

            if (!movies.movie_results[0])
                return this.error('No results found.');
            const movieID = movies.movie_results[0].id;

            return movieID;
        }

        const movies = await this.getMovies(query);
        if (movies.error) return movies;

        return movies[0].id;
    }

    // Get data for a movie
    async getMovie(query) {
        const movieID = await this.getMovieID(query);
        if (movieID.error) return movieID;

        const movie = await this.get(`movie/${movieID}`);
        if (movie.error) return movie;
        if (!movie.id) return this.error('Invalid ID.');

        return movie;
    }

    // Get multiple movies
    async getMovies(query, page, details) {
        page = page ? page : 1;

        const movies = await this.get(`search/movie`,
            `?query=${query}&page=${page}&include_adult=true`);
        if (movies.error) return movies;
        if (!movies.results[0]) return this.error('No results found.');

        if (details) return movies;
        return movies.results;
    }

    async getSimilarMovies(query) {
        const movieID = await this.getMovieID(query);
        if (movieID.error) return movieID;

        const movies = await this.get(`movie/${movieID}/similar`, '?page=1');
        if (movies.error) return movies;

        return movies.results.slice(0, 10);
    }

    async getUpcomingMovies() {
        const movies = await this.get(`movie/upcoming`, '?page=1');
        if (movies.error) return movies;

        return movies.results.slice(0, 10);
    }

    async getTrailers(query) {
        const movieID = await this.getMovieID(query);
        if (movieID.error) return movieID;

        const videos = await this.get(`movie/${movieID}/videos`);
        if (videos.error) return videos;

        if (videos.results.length === 0)
            return this.error('No trailers found.');

        return videos.results.filter(video =>
            video.site === "YouTube" && video.type === "Trailer");
    }

    async getPoster(query) {
        const movies = await this.getMovies(query);
        if (movies.error) return movies;

        const movie = movies[0];
        const posterPath = movie.poster_path;

        try {
            const image = await fetch(`https://image.tmdb.org/t/p/original${posterPath}`);
            return image.buffer();
        } catch (err) {
            this.client.handlers.log.error(err);
            return this.error('No poster.');
        }
    }

    async getPersonID(query) {
        const ID = this.ID(query);

        if (ID === 'tmdb') return query.slice(1);

        if (ID === 'imdb') {
            const people = await this.get(`find/${query}`,
                '?external_source=imdb_id');
            if (people.error) return people;

            if (!people.person_results[0])
                return this.error('No results found.');
            const personID = people.person_results[0].id;

            return personID;
        }

        const people = await this.getPeople(query);
        if (people.error) return people;

        return people[0].id;
    }

    async getPeople(query, page, details) {
        page = page ? page : 1;

        const people = await this.get(`search/person`,
            `?query=${query}&page=${page}&include_adult=true`);
        if (people.error) return people;
        if (!people.results[0]) return this.error('No results found.');

        if (details) return people;
        return people.results
    }

    async getPerson(query) {
        const personID = await this.getPersonID(query);
        if (personID.error) return personID;

        const person = await this.get(`person/${personID}`);
        if (person.error) return person;
        if (!person.id) return this.error('Invalid ID.');

        return person;
    }

    async spooky() {
        const movies = await this.get('discover/movie',
            '?sort_by=popularity.desc&include_adult=true&with_genres=27');
        return movies.results;
    }
}

module.exports = APIHandler;