export default class Cookie {

    list: Record<string, string>;

    constructor(cookies?: string) {
        this.list = {};
        (cookies || '').split(';')
            .filter(cookie => cookie.trim())
            .forEach(cookie => {
                const pair = cookie.split('=');
                this.set(pair.shift()!, pair.join('='));
            });
    }

    toString(): string {
        return Object.keys(this.list)
            .filter(key => this.list[key] !== 'EXPIRED')
            .map(key => key + '=' + this.list[key])
            .join('; ');
    }

    get(key: string): string {
        return this.list[key];
    }

    set(key: string, value: string): void {
        this.list[key.toString().trim()] = value.toString().trim();
    }

    delete(key: string): void {
        delete this.list[key];
    }

    merge(cookie: Cookie): Cookie {
        const result = new Cookie();
        Object.keys(this.list).forEach(key => result.set(key, this.list[key]));
        if(cookie instanceof Cookie) {
            Object.keys(cookie.list).forEach(key => result.set(key, cookie.list[key]));
        }
        return result;
    }

    static applyCrossSiteCookies(headers: Record<string, string | string[]>): void {
        let cookies = headers['set-cookie'] || headers['Set-Cookie'];
        if(!cookies) {
            return;
        }
        if(!Array.isArray(cookies)) {
            cookies = [ cookies ];
        }
        for(const index in cookies) {
            cookies[index] = [ ...cookies[index].split(';').map(part => part.trim()).filter(part => !/^SameSite=/i.test(part)), 'SameSite=None' ].join('; ');
        }
    }
}
